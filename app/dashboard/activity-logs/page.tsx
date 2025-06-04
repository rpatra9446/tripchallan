"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  ArrowLeft,
  Smartphone,
  Monitor,
  Filter,
  RefreshCw,
  Star,
  AlertTriangle,
  Download,
  Calendar,
  Search
} from 'lucide-react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Drawer,
  IconButton,
  Chip,
  Divider,
  Stack,
  Grid
} from '@mui/material';
import { formatDate, detectDevice } from '@/lib/utils';
// DatePicker components removed to fix deployment issues
import { format } from 'date-fns';
import { 
  ActivityLog, 
  ActivityLogDetails, 
  ActivityLogRow,
  FilterOptions,
  User
} from './types';
import useTransformLogs, { extractFilterOptions } from './effect-transform';

// Main component
export default function ActivityLogsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  
  // Use our custom transform hook to handle log data transformation
  const { tableData } = useTransformLogs(logs);
  
  const [filteredData, setFilteredData] = useState<ActivityLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<{name: string, email: string}[]>([]);
  const [availableResourceTypes, setAvailableResourceTypes] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    action: '',
    startDate: null,
    endDate: null,
    user: '',
    resourceType: ''
  });
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Extract filter options when tableData changes
  useEffect(() => {
    if (tableData.length > 0) {
      const { actions, users, resourceTypes } = extractFilterOptions(tableData);
      setAvailableActions(actions);
      setAvailableUsers(users);
      setAvailableResourceTypes(resourceTypes);
      setFilteredData(tableData)} else {
      setFilteredData([])}
  }, [tableData]);

  // Fetch activity logs with robust error handling
  const fetchActivityLogs = useCallback(async (pageNum: number, useDebugMode = false) => {
    try {
      console.log(`Fetching activity logs for page ${pageNum}...`);
      setIsLoading(true);
      setError('');
      
      // Use debug mode by default to ensure we get data
      const url = useDebugMode 
        ? `/api/activity-logs?page=${pageNum}&debug=true` 
        : `/api/activity-logs?page=${pageNum}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)}
      
      const data = await response.json();
      console.log('API Response:', data);
      
      if (!data || !data.logs || !Array.isArray(data.logs)) {
        console.warn('Invalid API response format:', data);
        setLogs([]);
        setTotalPages(1)} else {
        setLogs(data.logs);
        setTotalPages(data.meta?.totalPages || 1)}
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setError(`Failed to load activity logs: ${err instanceof Error ? err.message : String(err)}`);
      setLogs([])} finally {
      setIsLoading(false)}
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchActivityLogs(page)}, [fetchActivityLogs, page]);

  // Create test log data
  const createTestLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/force-create-test-logs');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create test logs: ${errorText}`)}
      
      const result = await response.json();
      alert(`Created ${result.logs?.length || 0} test logs. Refreshing...`);
      fetchActivityLogs(1, true)} catch (error: any) {
      console.error('Error creating test logs:', error);
      alert(`Error creating test logs: ${error.message || String(error)}`)} finally {
      setIsLoading(false)}
  }, [fetchActivityLogs]);

  // Apply filters effect
  useEffect(() => {
    if (tableData.length === 0) return;
    
    let filtered = [...tableData];
    const activeFiltersList: string[] = [];
    
    // Filter by action
    if (filters.action) {
      filtered = filtered.filter(row => row.action === filters.action);
      activeFiltersList.push(`Action: ${formatAction(filters.action)}`)}
    
    // Filter by date range
    if (filters.startDate) {
      const startTimestamp = filters.startDate.getTime();
      filtered = filtered.filter(row => {
        const rowDate = new Date(row.createdAt).getTime();
        return rowDate >= startTimestamp});
      activeFiltersList.push(`After: ${format(filters.startDate, 'MMM dd, yyyy')}`)}
    
    if (filters.endDate) {
      const endTimestamp = filters.endDate.getTime();
      filtered = filtered.filter(row => {
        const rowDate = new Date(row.createdAt).getTime();
        return rowDate <= endTimestamp});
      activeFiltersList.push(`Before: ${format(filters.endDate, 'MMM dd, yyyy')}`)}
    
    // Filter by user
    if (filters.user) {
      filtered = filtered.filter(row => row.user.email === filters.user);
      const userName = availableUsers.find(u => u.email === filters.user)?.name || filters.user;
      activeFiltersList.push(`User: ${userName}`)}
    
    // Filter by resource type
    if (filters.resourceType) {
      filtered = filtered.filter(row => row.targetResourceType === filters.resourceType);
      activeFiltersList.push(`Resource: ${filters.resourceType}`)}
    
    setActiveFilters(activeFiltersList);
    setFilteredData(filtered)}, [filters, tableData, availableUsers]);

  // Initialize data load
  useEffect(() => {
    fetchActivityLogs(1)}, [fetchActivityLogs]);

  // Handle pagination change
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage + 1);
    fetchActivityLogs(newPage + 1)};

  // Handle rows per page change  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(1);
    fetchActivityLogs(1)};

  // Render device icon
  const renderDeviceIcon = (details?: ActivityLogDetails, userAgent?: string) => {
    const device = userAgent ? detectDevice(userAgent) : 'unknown';
    return (
      <span style={{ display: 'flex', alignItems: 'center' }}>
        {device === 'mobile' ? <Smartphone size={16} /> : <Monitor size={16} />}
      </span>
    )};

  // Format action for display
  const formatAction = (action: string) => {
    return action.charAt(0) + action.slice(1).toLowerCase()};

  // Reset filters
  const resetFilters = () => {
    setFilters({
      action: '',
      startDate: null,
      endDate: null,
      user: '',
      resourceType: ''
    })};

  // Handle date input changes
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value ? new Date(e.target.value) : null;
    setFilters({...filters, startDate: dateValue})};

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value ? new Date(e.target.value) : null;
    setFilters({...filters, endDate: dateValue})};

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => router.push('/dashboard')} sx={{ mr: 1 }}>
            <ArrowLeft />
          </IconButton>
          <Typography variant="h5">Activity Logs</Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            startIcon={<Filter />} 
            onClick={() => setFilterDrawerOpen(true)}
          >
            Filter
          </Button>
          <Button 
            variant="outlined"
            startIcon={<RefreshCw />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Box>
      </Box>
      
      {/* Active filters */}
      {activeFilters.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Paper sx={{ p: 1, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2">Active Filters:</Typography>
            {activeFilters.map((filter, index) => (
              <Chip key={index} label={filter} size="small" />
            ))}
            <Button size="small" onClick={resetFilters}>
              Clear All
            </Button>
          </Paper>
        </Box>
      )}
      
      {/* Filter drawer */}
      <Box>
        <Drawer
          anchor="right"
          open={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          PaperProps={{ sx: { width: { xs: '100%', sm: 320 }, p: 3 } }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Filter Logs</Typography>
            <IconButton onClick={() => setFilterDrawerOpen(false)}>
              <ArrowLeft />
            </IconButton>
          </Box>
            
          <Divider sx={{ mb: 3 }} />
            
          <Stack spacing={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Action</InputLabel>
              <Select
                value={filters.action}
                label="Action"
                onChange={(e) => setFilters({...filters, action: e.target.value as string})}
              >
                <MenuItem value="">All Actions</MenuItem>
                {availableActions.map(action => (
                  <MenuItem key={action} value={action}>{formatAction(action)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {/* Simple date inputs instead of DatePicker */}
            <TextField
              label="Start Date"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : ''}
              onChange={handleStartDateChange}
            />
            
            <TextField
              label="End Date"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : ''}
              onChange={handleEndDateChange}
            />
            
            <FormControl fullWidth size="small">
              <InputLabel>User</InputLabel>
              <Select
                value={filters.user}
                label="User"
                onChange={(e) => setFilters({...filters, user: e.target.value as string})}
              >
                <MenuItem value="">All Users</MenuItem>
                {availableUsers.map(user => (
                  <MenuItem key={user.email} value={user.email}>
                    {user.name} ({user.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth size="small">
              <InputLabel>Resource Type</InputLabel>
              <Select
                value={filters.resourceType}
                label="Resource Type"
                onChange={(e) => setFilters({...filters, resourceType: e.target.value as string})}
              >
                <MenuItem value="">All Resources</MenuItem>
                {availableResourceTypes.map(type => (
                  <MenuItem key={type} value={type}>
                    {type === "USER_LIST" ? "Resources" : type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button 
                variant="contained" 
                fullWidth
                onClick={() => setFilterDrawerOpen(false)}
              >
                Apply Filters
              </Button>
              <Button 
                variant="outlined" 
                fullWidth
                onClick={resetFilters}
              >
                Reset
              </Button>
            </Box>
          </Stack>
        </Drawer>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="error">{error}</Alert>
          <Button
            variant="contained"
            color="primary"
            onClick={handleRefresh}
            sx={{ mt: 2 }}
          >
            Try Again
          </Button>
        </Box>
      ) : filteredData.length === 0 ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="info">
            <Typography variant="body1" sx={{ mb: 1 }}>No activity logs found. This could be because:</Typography>
            <ul>
              <li>There are no activities recorded yet in the system</li>
              <li>Your user role doesn't have permission to view these logs</li>
              <li>There was an error retrieving the data</li>
              <li>The current filters are excluding all available data</li>
            </ul>
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleRefresh}
                startIcon={<RefreshCw size={16} />}
              >
                Refresh Activity Logs
              </Button>
              {activeFilters.length > 0 && (
                <Button
                  variant="outlined"
                  onClick={resetFilters}
                >
                  Clear Filters
                </Button>
              )}
              {session?.user?.role === "SUPERADMIN" && (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={createTestLogs}
                  startIcon={<Star size={16} />}
                >
                  Create Test Logs
                </Button>
              )}
            </Box>
          </Alert>
        </Box>
      ) : (
        <Card>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredData.slice((page-1)*rowsPerPage, page*rowsPerPage).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 500 }}>{row.user.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#666' }}>{row.user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {renderDeviceIcon(row.details, row.userAgent)}
                          <span>{formatAction(row.action)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.targetUser ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{row.targetUser.name}</span>
                            <span style={{ fontSize: '0.75rem', color: '#666' }}>{row.targetUser.email}</span>
                          </div>
                        ) : (
                          <span>{row.targetResourceType || ' - '}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDate(row.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={totalPages * rowsPerPage}
                page={page - 1}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  )} 