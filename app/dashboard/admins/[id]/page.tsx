"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  Button, 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogContentText, 
  DialogTitle,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Paper,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Box,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from "@mui/material";
import { ArrowLeft, Coins, Trash2 } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserRole } from "@/prisma/enums";

interface AdminDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  coins: number;
  createdAt: string;
  updatedAt: string;
  createdCompanies: CreatedEntity[];
  createdEmployees: CreatedEntity[];
  stats: {
    totalCompanies: number;
    totalEmployees: number;
    totalSessions?: number;
  };
  sessions: SessionEntity[];
}

interface CreatedEntity {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  coins?: number;
  role?: string;
  subrole?: string;
  company?: {
    id: string;
    name: string;
  };
}

interface SessionEntity {
  id: string;
  source: string;
  destination: string;
  status: string;
  createdAt: string;
  company: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
    subrole: string;
  };
  seal?: {
    id: string;
    barcode: string;
    verified: boolean;
    scannedAt: string | null;
  };
  tripDetails?: {
    vehicleNumber?: string;
    loadingSite?: string;
    // Other trip details...
  };
}

interface Session {
  id: string;
  source: string;
  destination: string;
  status: string;
  createdAt: string;
  seal: {
    id: string;
    barcode: string;
    verified: boolean;
    scannedAt: Date | null;
  } | null;
}

interface AdminDetailsPageProps {
  params: {
    id: string;
  };
}

export default function AdminDetailsPage({ params }: AdminDetailsPageProps) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [sessions, setSessions] = useState<SessionEntity[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [accessibleCompanies, setAccessibleCompanies] = useState<any[]>([]);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [grantingAccess, setGrantingAccess] = useState(false);

  const fetchAdminDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/admins/${params.id}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error || `Failed to fetch admin details: ${response.status}`;
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (!data || !data.id) {
        throw new Error("Invalid admin data received");
      }
      
      setAdmin(data);
      
      // Also fetch the companies this admin can access
      fetchAccessibleCompanies();
    } catch (err) {
      console.error("Error fetching admin details:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch admin details"));
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (session?.user) {
      fetchAdminDetails();
    }
  }, [session?.user, fetchAdminDetails]);

  useEffect(() => {
    if (sessionStatus === 'loading') {
      return; // Still determining session status
    }
    
    if (!session?.user) {
      router.push("/");
      return;
    }

    // Only superadmins can view admin details
    if (session.user.role !== UserRole.SUPERADMIN) {
      router.push("/dashboard");
    }
  }, [session?.user, sessionStatus, router]);

  const fetchSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      setSessionsError(null);
      
      console.log(`Fetching sessions for admin ${params.id}...`);
      const response = await fetch(`/api/admins/${params.id}/sessions?timestamp=${Date.now()}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to fetch sessions: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Received ${data.sessions?.length || 0} sessions for admin, total count: ${data.totalCount || 0}`);
      
      // Log the first few sessions for debugging
      if (data.sessions && data.sessions.length > 0) {
        console.log("Sample sessions:", data.sessions.slice(0, 3).map((s: any) => ({
          id: s.id,
          company: s.company?.name,
          source: s.source,
          destination: s.destination,
          status: s.status
        })));
      } else {
        console.log("No sessions returned from API");
      }
      
      setSessions(data.sessions || []);
      
      // Update stats if needed - use functional update to avoid dependency on admin
      if (data.totalCount !== undefined) {
        setAdmin((currentAdmin) => {
          if (!currentAdmin) return null;
          return {
            ...currentAdmin,
            stats: {
              ...currentAdmin.stats,
              totalSessions: data.totalCount
            }
          };
        });
      }
    } catch (err) {
      console.error("Error fetching sessions:", err);
      setSessionsError("Failed to load sessions. Please try again later.");
    } finally {
      setLoadingSessions(false);
    }
  }, [params.id]);

  // Fetch sessions when tab changes to sessions
  useEffect(() => {
    if (tabValue === 2 && params.id) {
      fetchSessions();
    }
  }, [tabValue, params.id, fetchSessions]);

  // Fetch all companies
  const fetchCompanies = async () => {
    try {
      const response = await fetch("/api/companies");
      if (!response.ok) {
        throw new Error("Failed to fetch companies");
      }
      
      const data = await response.json();
      setCompanies(data);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  // Fetch companies accessible to this admin
  const fetchAccessibleCompanies = async () => {
    try {
      // Check if custom_permissions table exists and query it
      // We'll use a proxy endpoint that checks permissions
      const response = await fetch(`/api/admins/${params.id}/accessible-companies`);
      
      if (response.ok) {
        const data = await response.json();
        setAccessibleCompanies(data.companies || []);
      } else {
        // Fallback: check the companies this admin has created employees for
        const employeeResponse = await fetch(`/api/admins/${params.id}/employee-companies`);
        if (employeeResponse.ok) {
          const employeeData = await employeeResponse.json();
          setAccessibleCompanies(employeeData.companies || []);
        }
      }
    } catch (error) {
      console.error("Error fetching accessible companies:", error);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy HH:mm:ss");
  };

  // Handle admin deletion
  const handleDeleteAdmin = async () => {
    setDeleteLoading(true);
    setDeleteError("");
    
    try {
      const response = await fetch(`/api/admins/${params.id}`, {
        method: "DELETE",
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Check if this is a resource constraint error
        if (data.resourceCount && data.resourceCount > 0) {
          throw new Error(
            `This admin has created ${data.resourceCount} resources. ` +
            `Please reassign or delete their companies and employees first.`
          );
        }
        throw new Error(data.error || "Failed to delete admin");
      }
      
      // Success - redirect back to dashboard
      toast.success("Admin deleted successfully");
      router.push("/dashboard/admins");
    } catch (err: unknown) {
      console.error("Error deleting admin:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to delete admin";
      setDeleteError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    
    // Always refresh sessions data when switching to the sessions tab
    if (newValue === 2) {
      fetchSessions();
    }
  };

  // Get color for session status chip
  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "warning";
      case "IN_PROGRESS":
        return "info";
      case "COMPLETED":
        return "success";
      default:
        return "default";
    }
  };

  // Calculate if admin can be deleted (no companies or employees created)
  const canDeleteAdmin = !admin?.stats?.totalCompanies && !admin?.stats?.totalEmployees;

  // Open company dialog
  const handleOpenCompanyDialog = () => {
    setSelectedCompany("");
    setCompanyDialogOpen(true);
  };

  // Close company dialog
  const handleCloseCompanyDialog = () => {
    setCompanyDialogOpen(false);
  };

  // Handle company selection
  const handleCompanyChange = (event: any) => {
    setSelectedCompany(event.target.value);
  };

  // Grant company access to admin
  const handleGrantAccess = async () => {
    if (!selectedCompany) {
      toast.error("Please select a company");
      return;
    }
    
    setGrantingAccess(true);
    
    try {
      const response = await fetch("/api/superadmin/grant-company-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminId: params.id,
          companyId: selectedCompany,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to grant access");
      }
      
      toast.success("Company access granted successfully");
      handleCloseCompanyDialog();
      fetchAccessibleCompanies();
    } catch (error) {
      console.error("Error granting company access:", error);
      toast.error(error instanceof Error ? error.message : "Failed to grant access");
    } finally {
      setGrantingAccess(false);
    }
  };

  // Filter out companies that admin already has access to
  const getAvailableCompanies = () => {
    const accessibleIds = accessibleCompanies.map(company => company.id);
    return companies.filter(company => !accessibleIds.includes(company.id));
  };

  // Show error UI if there's a problem
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md p-6 bg-white shadow-lg rounded-lg">
          <Typography variant="h5" color="error" gutterBottom>
            Error Loading Admin
          </Typography>
          <Typography variant="body1" gutterBottom>
            {error.message || "Failed to load admin details. Please try again."}
          </Typography>
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => fetchAdminDetails()}
            >
              Try Again
            </Button>
            <Button
              variant="outlined"
              component={Link}
              href="/dashboard/admins"
            >
              Back to Admins
            </Button>
          </Box>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading || !admin) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh', flexDirection: 'column' }}>
        <CircularProgress size={60} thickness={4} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading admin details...
        </Typography>
      </Box>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              try {
                router.push("/dashboard/admins");
              } catch (err) {
                console.error("Navigation error:", err);
                // Fallback to Link navigation
                window.location.href = "/dashboard/admins";
              }
            }}
            startIcon={<ArrowLeft size={16} />}
          >
            Back
          </Button>
          <Typography variant="h5" component="h1" fontWeight="bold">
            Admin Details
          </Typography>
        </div>
        
        <Button 
          variant="contained"
          color="error"
          size="small"
          disabled={!canDeleteAdmin || deleteLoading}
          startIcon={<Trash2 size={16} />}
          onClick={() => setShowDeleteConfirm(true)}
          title={!canDeleteAdmin ? "Cannot delete admin with created resources" : "Delete admin"}
        >
          Delete Admin
        </Button>
      </div>
      
      {!canDeleteAdmin && (
        <Paper 
          sx={{ 
            p: 2, 
            mb: 3, 
            bgcolor: "warning.light", 
            color: "warning.dark",
            border: 1,
            borderColor: "warning.main"
          }}
          elevation={0}
        >
          <Typography>
            This admin cannot be deleted because they have created companies or employees. 
            Please reassign or delete these resources first.
          </Typography>
        </Paper>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader 
            title="Coin Balance" 
            titleTypographyProps={{ variant: "subtitle2" }}
            sx={{ pb: 1 }}
          />
          <CardContent>
            <Typography variant="h4" fontWeight="bold" color="primary">
              {(admin.coins || 0).toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader 
            title="Companies Created" 
            titleTypographyProps={{ variant: "subtitle2" }}
            sx={{ pb: 1 }}
          />
          <CardContent>
            <Typography variant="h4" fontWeight="bold" color="info.main">
              {admin.stats.totalCompanies}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader 
            title="Employees Created" 
            titleTypographyProps={{ variant: "subtitle2" }}
            sx={{ pb: 1 }}
          />
          <CardContent>
            <Typography variant="h4" fontWeight="bold" color="success.main">
              {admin.stats.totalEmployees}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader 
            title="Total Sessions" 
            titleTypographyProps={{ variant: "subtitle2" }}
            sx={{ pb: 1 }}
          />
          <CardContent>
            <Typography variant="h4" fontWeight="bold" color="secondary.main">
              {admin.stats.totalSessions || 0}
              {tabValue !== 2 && loadingSessions && (
                <CircularProgress size={16} sx={{ ml: 1 }} />
              )}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader 
            title="Account Created" 
            titleTypographyProps={{ variant: "subtitle2" }}
            sx={{ pb: 1 }}
          />
          <CardContent>
            <Typography variant="body1" fontWeight="medium">
              {formatDate(admin.createdAt)}
            </Typography>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
        <div className="md:col-span-4">
          <Card>
            <CardHeader title="Basic Information" />
            <CardContent>
              <Box component="dl" sx={{ display: "grid", gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Name</Typography>
                  <Typography>{admin.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Email</Typography>
                  <Typography>{admin.email}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Role</Typography>
                  <Chip label={admin.role} variant="outlined" size="small" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-8">
          <Card>
            <CardHeader title="Account Information" />
            <CardContent>
              <Box component="dl" sx={{ display: "grid", gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Created At</Typography>
                  <Typography>{formatDate(admin.createdAt)}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Last Updated</Typography>
                  <Typography>{formatDate(admin.updatedAt)}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">ID</Typography>
                  <Typography sx={{ wordBreak: "break-all" }}>{admin.id}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Box sx={{ width: '100%', mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', overflowX: 'auto' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ maxWidth: '100%' }}
          >
            <Tab label={`Companies Created (${admin.stats.totalCompanies})`} />
            <Tab label={`Employees (${admin.stats.totalEmployees})`} />
            <Tab label={`Sessions (${admin.stats.totalSessions || 0})`} />
          </Tabs>
        </Box>
        
        <Box hidden={tabValue !== 0} sx={{ pt: 3 }}>
          <TableContainer component={Paper} sx={{ overflowX: 'auto', maxWidth: '100%' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Company Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Created On</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {admin.createdCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">No companies created by this admin</TableCell>
                  </TableRow>
                ) : (
                  admin.createdCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>{company.name}</TableCell>
                      <TableCell>{company.email}</TableCell>
                      <TableCell>{formatDate(company.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
        
        <Box hidden={tabValue !== 1} sx={{ pt: 3 }}>
          <TableContainer component={Paper} sx={{ overflowX: 'auto', maxWidth: '100%' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Subrole</TableCell>
                  <TableCell>Coins</TableCell>
                  <TableCell>Created On</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {admin.createdEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No employees created by this admin</TableCell>
                  </TableRow>
                ) : (
                  admin.createdEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.company?.name || 'N/A'}</TableCell>
                      <TableCell>{employee.subrole || 'N/A'}</TableCell>
                      <TableCell>
                        {employee.role === 'GUARD' 
                          ? 'Not Applicable' 
                          : (employee.coins || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>{formatDate(employee.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
        
        <Box hidden={tabValue !== 2} sx={{ pt: 3 }}>
          {sessionsError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {sessionsError}
            </Alert>
          )}
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={fetchSessions}
              disabled={loadingSessions}
            >
              {loadingSessions ? "Loading..." : "Refresh Sessions"}
            </Button>
          </Box>
          
          {loadingSessions ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ overflowX: 'auto', maxWidth: '100%' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Destination</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Created By</TableCell>
                    <TableCell>Vehicle Number</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created On</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center">
                        <Box p={3} display="flex" flexDirection="column" alignItems="center" gap={2}>
                          <Typography variant="body1">
                            No sessions found for companies managed by this admin
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            This admin may not have created any companies, or the companies haven't created any sessions.
                          </Typography>
                          <Button 
                            variant="contained" 
                            size="small" 
                            onClick={fetchSessions}
                            disabled={loadingSessions}
                            sx={{ mt: 1 }}
                          >
                            Retry
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{session.id.substring(0, 8)}...</TableCell>
                        <TableCell>{session.source}</TableCell>
                        <TableCell>{session.destination}</TableCell>
                        <TableCell>{session.company.name}</TableCell>
                        <TableCell>{session.createdBy.name}</TableCell>
                        <TableCell>{session.tripDetails?.vehicleNumber || "N/A"}</TableCell>
                        <TableCell>
                          <Chip 
                            label={session.status} 
                            color={getStatusColor(session.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{formatDate(session.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            component={Link}
                            href={`/dashboard/sessions/${session.id}`}
                            size="small"
                            variant="outlined"
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Box>
      
      {/* Company Access Management */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5">Company Access</Typography>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleOpenCompanyDialog}
            disabled={getAvailableCompanies().length === 0}
          >
            Grant Access
          </Button>
        </Box>
        
        {accessibleCompanies.length === 0 ? (
          <Typography variant="body1" color="text.secondary">
            This admin does not have access to any companies yet.
          </Typography>
        ) : (
          <List>
            {accessibleCompanies.map((company, index) => (
              <React.Fragment key={company.id}>
                {index > 0 && <Divider />}
                <ListItem>
                  <ListItemText 
                    primary={company.name} 
                    secondary={company.email} 
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
      
      {/* Grant Company Access Dialog */}
      <Dialog open={companyDialogOpen} onClose={handleCloseCompanyDialog}>
        <DialogTitle>Grant Company Access</DialogTitle>
        <DialogContent sx={{ minWidth: 400 }}>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="company-select-label">Company</InputLabel>
            <Select
              labelId="company-select-label"
              value={selectedCompany}
              onChange={handleCompanyChange}
              label="Company"
            >
              <MenuItem value="" disabled>Select a company</MenuItem>
              {getAvailableCompanies().map((company) => (
                <MenuItem key={company.id} value={company.id}>
                  {company.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCompanyDialog}>Cancel</Button>
          <Button 
            onClick={handleGrantAccess} 
            color="primary"
            disabled={!selectedCompany || grantingAccess}
          >
            {grantingAccess ? "Granting..." : "Grant Access"}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
      >
        <DialogTitle>Delete Admin User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {canDeleteAdmin 
              ? "Are you sure you want to delete this admin user? This action cannot be undone."
              : "This admin user cannot be deleted because they have created companies or employees. You must first reassign or delete these resources."
            }
          </DialogContentText>
          {deleteError && (
            <Box mt={2} p={2} bgcolor="error.light" color="error.dark" borderRadius={1}>
              {deleteError}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirm(false)} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteAdmin} 
            color="error" 
            disabled={!canDeleteAdmin || deleteLoading}
          >
            {deleteLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
} 