"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, createContext } from "react";
import Link from "next/link";
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box, 
  Button, 
  Avatar, 
  Chip, 
  IconButton, 
  Menu, 
  MenuItem, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton,
  ListItemIcon, 
  ListItemText, 
  Divider 
} from "@mui/material";
import { 
  Menu as MenuIcon, 
  AccountCircle, 
  Dashboard, 
  Business, 
  Person, 
  Logout, 
  History 
} from "@mui/icons-material";
import { useRouter } from "next/navigation";

// Create a context to update coin balance
export const SessionUpdateContext = createContext({
  refreshUserSession: async () => {}
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, update: updateSession } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  // Add state to track the last coin balance update
  const [lastBalanceUpdate, setLastBalanceUpdate] = useState(Date.now());
  // Track current pathname for refreshing on navigation
  const [currentPath, setCurrentPath] = useState("");
  // Add direct state for coin balance to bypass session caching
  const [currentCoinBalance, setCurrentCoinBalance] = useState<number | null>(null);

  const isMenuOpen = Boolean(anchorEl);

  // Effect to track current pathname
  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  // Effect to check localStorage for recent coin balance updates
  useEffect(() => {
    const checkLocalCoinBalance = () => {
      try {
        const lastCoinBalance = localStorage.getItem('lastCoinBalance');
        const updatedAt = localStorage.getItem('coinBalanceUpdatedAt');
        
        if (lastCoinBalance && updatedAt) {
          // Only use localStorage value if it's less than 10 seconds old
          const updateTime = parseInt(updatedAt);
          const now = Date.now();
          const secondsSinceUpdate = (now - updateTime) / 1000;
          
          if (secondsSinceUpdate < 10) {
            console.log('Using recent coin balance from localStorage:', lastCoinBalance);
            setCurrentCoinBalance(parseInt(lastCoinBalance));
            setLastBalanceUpdate(now);
            
            // Clear localStorage after using it
            setTimeout(() => {
              localStorage.removeItem('lastCoinBalance');
              localStorage.removeItem('coinBalanceUpdatedAt');
            }, 1000);
            
            // Force refresh session data as well
            refreshUserSession();
          }
        }
      } catch (error) {
        console.error('Error checking localStorage for coin balance:', error);
      }
    };
    
    checkLocalCoinBalance();
  }, []);

  // Effect to initialize coin balance from session
  useEffect(() => {
    if (session?.user?.coins !== undefined) {
      setCurrentCoinBalance(session.user.coins);
    }
  }, [session?.user?.coins]);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    // Use our dedicated logout page with useRouter for better navigation
    router.push('/logout?callbackUrl=/');
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  // Function to refresh the user session data
  const refreshUserSession = async () => {
    try {
      // First, fetch updated user data directly from API using cache: 'no-store' to ensure fresh data
      const response = await fetch('/api/users/me', { 
        cache: 'no-store',
        headers: {
          'pragma': 'no-cache',
          'cache-control': 'no-cache'
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        
        // Immediately update the local state with the latest coin balance
        setCurrentCoinBalance(userData.coins);
        
        // Then update NextAuth session with the latest data
        await updateSession({
          ...session,
          user: {
            ...session?.user,
            coins: userData.coins,
          }
        });
        
        // Trigger a re-render of components that depend on the coin balance
        setLastBalanceUpdate(Date.now());
        
        return userData.coins;
      } else {
        console.error('Failed to fetch updated user data');
        return null;
      }
    } catch (error) {
      console.error('Error refreshing user session:', error);
      return null;
    }
  };

  // Remove the automatic refresh that runs every few seconds - it's annoying users
  useEffect(() => {
    // Only refresh once on initial load for admin users
    if (session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN') {
      refreshUserSession();
    }
  }, [session?.user?.id]);

  // Only refresh when path changes, not on an interval
  useEffect(() => {
    if (session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN') {
      refreshUserSession();
    }
  }, [currentPath]);

  const handleProfileClick = () => {
    handleMenuClose();
    router.push('/dashboard/profile');
  };

  const renderMenu = (
    <Menu
      anchorEl={anchorEl}
      open={isMenuOpen}
      onClose={handleMenuClose}
      transformOrigin={{ horizontal: "right", vertical: "top" }}
      anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
    >
      <MenuItem onClick={handleProfileClick}>
        <ListItemIcon>
          <AccountCircle fontSize="small" />
        </ListItemIcon>
        <ListItemText>Profile</ListItemText>
      </MenuItem>
      <MenuItem onClick={handleLogout}>
        <ListItemIcon>
          <Logout fontSize="small" />
        </ListItemIcon>
        <ListItemText>Logout</ListItemText>
      </MenuItem>
    </Menu>
  );

  return (
    <SessionUpdateContext.Provider value={{ refreshUserSession }}>
      <div className="min-h-screen bg-gray-50">
        <AppBar position="static">
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={toggleDrawer}
              sx={{ mr: 2, display: { xs: "block", sm: "none" } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 2 }}>
              CBUMS
            </Typography>
            <Box sx={{ display: { xs: "none", sm: "block" }, mr: 2 }}>
              <Button color="inherit" component={Link} href="/dashboard">
                Dashboard
              </Button>
              {(session?.user?.role === "ADMIN" || session?.user?.role === "SUPERADMIN") && (
                <Button color="inherit" component={Link} href="/dashboard/activity-logs">
                  Activity Logs
                </Button>
              )}
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            {session?.user && (
              <>
                {session.user.role !== "COMPANY" && session.user.subrole !== "GUARD" && (
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Chip
                      key={`coins-${lastBalanceUpdate}-${currentCoinBalance || session?.user?.coins || 0}`}
                      label={`${currentCoinBalance !== null ? currentCoinBalance : (session?.user?.coins || 0)} Coins`}
                      color="secondary"
                      sx={{ mr: 2, bgcolor: "rgba(255,255,255,0.15)" }}
                      onClick={refreshUserSession}
                    />
                  </Box>
                )}
                <Box display="flex" alignItems="center">
                  <Typography variant="body2" sx={{ mr: 1, display: { xs: "none", sm: "block" } }}>
                    {session.user.name}
                  </Typography>
                  <Chip
                    label={session.user.role.toLowerCase()}
                    size="small"
                    sx={{ 
                      mr: 2, 
                      textTransform: "capitalize",
                      bgcolor: "rgba(255,255,255,0.15)", 
                      display: { xs: "none", sm: "block" } 
                    }}
                  />
                  <IconButton
                    edge="end"
                    color="inherit"
                    onClick={handleProfileMenuOpen}
                  >
                    <Avatar
                      sx={{ width: 32, height: 32, bgcolor: "secondary.main" }}
                    >
                      {session.user.name?.[0] || "U"}
                    </Avatar>
                  </IconButton>
                </Box>
              </>
            )}
          </Toolbar>
        </AppBar>
        {renderMenu}

        <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer}>
          <Box
            sx={{ width: 250 }}
            role="presentation"
            onClick={toggleDrawer}
          >
            <List>
              <ListItem>
                <Typography variant="h6" color="primary">CBUMS Menu</Typography>
              </ListItem>
              <Divider />
              
              <ListItem disablePadding>
                <ListItemButton component={Link} href="/dashboard">
                  <ListItemIcon>
                    <Dashboard />
                  </ListItemIcon>
                  <ListItemText primary="Dashboard" />
                </ListItemButton>
              </ListItem>
              
              {session?.user?.role === "ADMIN" && (
                <ListItem disablePadding>
                  <ListItemButton component={Link} href="/dashboard/companies">
                    <ListItemIcon>
                      <Business />
                    </ListItemIcon>
                    <ListItemText primary="Companies" />
                  </ListItemButton>
                </ListItem>
              )}
              
              {(session?.user?.role === "ADMIN" || session?.user?.role === "COMPANY") && (
                <ListItem disablePadding>
                  <ListItemButton component={Link} href="/dashboard/employees">
                    <ListItemIcon>
                      <Person />
                    </ListItemIcon>
                    <ListItemText primary="Employees" />
                  </ListItemButton>
                </ListItem>
              )}
              
              {(session?.user?.role === "ADMIN" || session?.user?.role === "SUPERADMIN") && (
                <ListItem disablePadding>
                  <ListItemButton component={Link} href="/dashboard/activity-logs">
                    <ListItemIcon>
                      <History />
                    </ListItemIcon>
                    <ListItemText primary="Activity Logs" />
                  </ListItemButton>
                </ListItem>
              )}
              
              <Divider />
              
              <ListItem disablePadding>
                <ListItemButton component={Link} href="/dashboard/profile">
                  <ListItemIcon>
                    <AccountCircle />
                  </ListItemIcon>
                  <ListItemText primary="My Profile" />
                </ListItemButton>
              </ListItem>
              
              <ListItem disablePadding>
                <ListItemButton onClick={handleLogout}>
                  <ListItemIcon>
                    <Logout />
                  </ListItemIcon>
                  <ListItemText primary="Logout" />
                </ListItemButton>
              </ListItem>
            </List>
          </Box>
        </Drawer>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </SessionUpdateContext.Provider>
  );
} 