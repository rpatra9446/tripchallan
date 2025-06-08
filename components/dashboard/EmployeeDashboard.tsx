"use client";

import { useState, useContext, useEffect, useCallback } from "react";
import Link from "next/link";
import { EmployeeDashboardProps } from "./types";
import { Person, AccountCircle, Apartment, LocalAtm, DirectionsCar, CheckCircle, Delete } from "@mui/icons-material";
import TransferCoinsForm from "../coins/TransferCoinsForm";
import TransactionHistory from "../coins/TransactionHistory";
import VehicleForm, { VehicleFormData } from "../vehicles/VehicleForm";
import { useSession } from "next-auth/react";
import { SessionUpdateContext } from "@/app/dashboard/layout";
import { EmployeeSubrole } from "@/prisma/enums";
import { 
  Snackbar, 
  Alert, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField,
  Typography,
  IconButton 
} from "@mui/material";
import { Close } from "@mui/icons-material";

export default function EmployeeDashboard({ user }: EmployeeDashboardProps) {
  const [activeTab, setActiveTab] = useState("profile");
  const [refreshTransactions, setRefreshTransactions] = useState(0);
  const { data: session } = useSession();
  const { refreshUserSession } = useContext(SessionUpdateContext);
  const [currentUser, setCurrentUser] = useState(user);
  const [verificationSessions, setVerificationSessions] = useState<any[]>([]);
  const [loadingVerifications, setLoadingVerifications] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [operatorSessions, setOperatorSessions] = useState<any[]>([]);
  const [loadingOperatorSessions, setLoadingOperatorSessions] = useState(false);
  const [operatorSessionsError, setOperatorSessionsError] = useState("");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehiclesError, setVehiclesError] = useState("");
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [operatorPermissions, setOperatorPermissions] = useState({
    canCreate: false,
    canModify: false,
    canDelete: false
  });

  // Add state for delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Add snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning"
  });

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar({...snackbar, open: false});
  };

  // Show success message
  const showSuccessMessage = (message: string) => {
    setSnackbar({
      open: true,
      message,
      severity: "success"
    });
  };

  // Show error message
  const showErrorMessage = (message: string) => {
    setSnackbar({
      open: true,
      message,
      severity: "error"
    });
  };

  // Format the subrole for display
  const formattedSubrole = user.subrole ? String(user.subrole).toLowerCase().replace('_', ' ') : '';
  
  // Check if user is a GUARD (they don't use coins)
  const isGuard = user.subrole === EmployeeSubrole.GUARD;
  
  // Check if user is an OPERATOR (they can manage trips and have coins)
  const isOperator = user.subrole === EmployeeSubrole.OPERATOR;

  // Fetch latest user data when component mounts for Operators
  useEffect(() => {
    if (isOperator) {
      console.log("Component mounted, fetching current user data");
      fetchCurrentUser();
    }
  }, [isOperator]);

  // Fetch latest user data when tab changes to coins
  useEffect(() => {
    if (activeTab === "coins" && isOperator) {
      console.log("Tab changed to coins, fetching current user data");
      fetchCurrentUser();
    }
  }, [activeTab, isOperator]);

  // Fetch operator permissions when component mounts
  useEffect(() => {
    if (isOperator) {
      fetchOperatorPermissions();
    }
  }, [isOperator]);

  // Fetch operator permissions
  const fetchOperatorPermissions = async () => {
    try {
      const response = await fetch(`/api/employees/${session?.user?.id || user.id}/permissions`);
      
      if (response.ok) {
        const permissions = await response.json();
        setOperatorPermissions(permissions);
        console.log("Operator permissions loaded:", permissions);
      } else {
        console.error("Failed to fetch operator permissions, using secure defaults");
        // Even if the fetch fails, we keep permissions disabled for security
      }
    } catch (err) {
      console.error("Error fetching operator permissions:", err);
    }
  };

  // Fetch current user data
  const fetchCurrentUser = async () => {
    try {
      try {
        // Add cache busting to ensure we get fresh data
        const response = await fetch(`/api/users/${session?.user?.id || user.id}`, {
          cache: 'no-store',
          headers: {
            'pragma': 'no-cache',
            'cache-control': 'no-cache'
          }
        });
        const data = await response.json();
        
        if (data.user) {
          setCurrentUser(data.user);
          // Update session to reflect the latest user data
          await refreshUserSession();
          console.log("Updated user data - current coins:", data.user.coins);
          return;
        }
      } catch (err) {
        console.error("Error fetching user details, trying fallback:", err);
      }
      
      // Fallback: try /api/users/me endpoint
      try {
        const meResponse = await fetch('/api/users/me', {
          cache: 'no-store',
          headers: {
            'pragma': 'no-cache',
            'cache-control': 'no-cache'
          }
        });
        const meData = await meResponse.json();
        
        if (meData.id) {
          setCurrentUser(meData);
          // Update session to reflect the latest user data
          await refreshUserSession();
          console.log("Updated user data (fallback) - current coins:", meData.coins);
        }
      } catch (meErr) {
        console.error("Error in fallback user fetch:", meErr);
        // If all else fails, keep using user from props
      }
    } catch (err) {
      console.error("Error fetching current user (all attempts failed):", err);
    }
  };

  // Handle successful coin transfer
  const handleTransferSuccess = async () => {
    // Increment to trigger a refresh of the transaction history
    setRefreshTransactions(prev => prev + 1);
    // Update the session to reflect the latest coin balance
    await fetchCurrentUser();
  };

  // Wrap fetchVerificationSessions in useCallback to prevent infinite loop
  const fetchVerificationSessions = useCallback(async () => {
    setLoadingVerifications(true);
    setVerificationError("");
    
    try {
      console.log("[GUARD DEBUG] Starting verification session fetch");
      console.log("[GUARD DEBUG] Guard user:", {
        id: user.id,
        name: user.name,
        companyId: user.companyId,
        subrole: user.subrole
      });
      
      // Use a specific query to get only sessions needing verification
      const url = `/api/sessions?needsVerification=true&companyId=${user.companyId}`;
      console.log("[GUARD DEBUG] Fetch URL:", url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[GUARD DEBUG] API response not OK:", response.status, response.statusText);
        console.error("[GUARD DEBUG] API error details:", errorText);
        
        let errorMessage = "Failed to fetch sessions";
        try {
          // Try to parse error response as JSON
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseErr) {
          // If parsing fails, use the raw text
          if (errorText) {
            errorMessage = `Server error: ${errorText.substring(0, 100)}${errorText.length > 100 ? '...' : ''}`;
          }
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log("[GUARD DEBUG] API response:", data);
      console.log("[GUARD DEBUG] API response.sessions:", data.sessions);
      
      if (data.sessions && Array.isArray(data.sessions)) {
        console.log(`[GUARD DEBUG] Found ${data.sessions.length} sessions needing verification`);
        
        // Check for any sessions without seals
        const sessionsWithoutSeals = data.sessions.filter((session: any) => !session.seal);
        if (sessionsWithoutSeals.length > 0) {
          console.log(`[GUARD DEBUG] Found ${sessionsWithoutSeals.length} sessions without seals:`, sessionsWithoutSeals);
        }
        
        // Double-check on client side to ensure we only show valid sessions
        const sessionsNeedingVerification = data.sessions.filter((session: any) => {
          const hasValidSeal = session.seal && !session.seal.verified;
          const isInProgress = session.status === "IN_PROGRESS";
          const isSameCompany = String(session.companyId) === String(user.companyId);
          
          console.log(`[GUARD DEBUG] Session ${session.id} validation:`, {
            hasValidSeal,
            isInProgress,
            isSameCompany,
            sealInfo: session.seal,
            companyId: session.companyId,
            userCompanyId: user.companyId
          });
          
          return hasValidSeal && isInProgress && isSameCompany;
        });
        
        console.log(`[GUARD DEBUG] After client filtering: ${sessionsNeedingVerification.length} sessions`);
        if (sessionsNeedingVerification.length > 0) {
          console.log("[GUARD DEBUG] Verification sessions:", sessionsNeedingVerification);
        }
        
        setVerificationSessions(sessionsNeedingVerification);
      } else {
        console.error("[GUARD DEBUG] Unexpected API response format:", data);
        setVerificationSessions([]);
        setVerificationError("Received invalid data format from server");
      }
    } catch (err: any) {
      console.error("[GUARD DEBUG] Error fetching verification sessions:", err);
      setVerificationError(err?.message || "Failed to load sessions. Please try again.");
      setVerificationSessions([]);
    } finally {
      setLoadingVerifications(false);
    }
  }, [user.companyId, user.id, user.name, user.subrole]);

  // Keep the original check function as a fallback
  const checkAllCompanySessions = useCallback(async () => {
    if (!isGuard || !user.companyId) return;
    
    try {
      console.log("[GUARD DEBUG] Performing direct check for ALL sessions in the company");
      
      // Use a direct API call without filters
      const response = await fetch(`/api/sessions?companyId=${user.companyId}`);
      
      if (!response.ok) {
        console.error("[GUARD DEBUG] Direct API check failed:", response.status);
        return;
      }
      
      const data = await response.json();
      console.log("[GUARD DEBUG] Direct API check found sessions:", data);
      
      if (data.sessions && Array.isArray(data.sessions)) {
        console.log(`[GUARD DEBUG] Total sessions for company: ${data.sessions.length}`);
        
        // Find sessions that SHOULD be verifiable
        const potentialVerifiableSessions = data.sessions.filter((session: any) => {
          return session.status === "IN_PROGRESS";
        });
        
        console.log(`[GUARD DEBUG] IN_PROGRESS sessions: ${potentialVerifiableSessions.length}`);
        
        // Check how many have seals
        const sessionsWithSeals = potentialVerifiableSessions.filter((session: any) => session.seal);
        console.log(`[GUARD DEBUG] IN_PROGRESS sessions with seals: ${sessionsWithSeals.length}`);
        
        // Check how many have unverified seals
        const sessionsWithUnverifiedSeals = sessionsWithSeals.filter((session: any) => 
          session.seal && !session.seal.verified
        );
        
        console.log(`[GUARD DEBUG] IN_PROGRESS sessions with unverified seals: ${sessionsWithUnverifiedSeals.length}`);
        console.log("[GUARD DEBUG] These sessions SHOULD appear for verification:", sessionsWithUnverifiedSeals);
        
        // Force update the verification sessions if we found some that should be displayed
        if (sessionsWithUnverifiedSeals.length > 0) {
          console.log("[GUARD DEBUG] Manually updating verification sessions list with direct results");
          setVerificationSessions(sessionsWithUnverifiedSeals);
        }
      }
    } catch (error) {
      console.error("[GUARD DEBUG] Error in direct session check:", error);
    }
  }, [isGuard, user.companyId]);

  // Add a direct check for sessions that need verification, bypassing filters
  const checkAllSessionsForVerification = useCallback(async () => {
    if (!isGuard || !user.companyId) return;
    
    try {
      console.log("[GUARD DEBUG] Using direct guard-verification API endpoint");
      
      // Use the new dedicated API endpoint for guard verification
      const response = await fetch(`/api/guard-verification`);
      
      if (!response.ok) {
        console.error("[GUARD DEBUG] Guard verification API failed:", response.status);
        return;
      }
      
      const data = await response.json();
      console.log("[GUARD DEBUG] Guard verification API response:", data);
      
      if (data.sessions && Array.isArray(data.sessions)) {
        console.log(`[GUARD DEBUG] Found ${data.sessions.length} sessions needing verification`);
        
        if (data.sessions.length > 0) {
          console.log("[GUARD DEBUG] Sessions needing verification:", data.sessions);
          setVerificationSessions(data.sessions);
          
          // Show success notification if sessions were found
          if (data.sessions.length > 0) {
            console.log(`[GUARD DEBUG] Found ${data.sessions.length} sessions that need verification`);
          }
        } else {
          console.log("[GUARD DEBUG] No sessions found that need verification");
          
          // Fall back to original check method if nothing found
          console.log("[GUARD DEBUG] Falling back to original method to check all sessions");
          await checkAllCompanySessions();
        }
      }
    } catch (error) {
      console.error("[GUARD DEBUG] Error in guard verification check:", error);
      
      // Fall back to original check method if the new endpoint fails
      console.log("[GUARD DEBUG] Falling back to original method after error");
      await checkAllCompanySessions();
    }
  }, [isGuard, user.companyId, checkAllCompanySessions]);

  // Fetch verification sessions when the tab changes to verifications
  useEffect(() => {
    if (activeTab === "verifications" && isGuard) {
      fetchVerificationSessions();
    }
  }, [activeTab, isGuard, fetchVerificationSessions]);

  // Fetch verification sessions when the component loads for GUARD users
  useEffect(() => {
    if (isGuard) {
      fetchVerificationSessions();
    }
  }, [isGuard, fetchVerificationSessions]);

  useEffect(() => {
    if (activeTab === "trips" && isOperator) {
      fetchOperatorSessions();
    }
  }, [activeTab, isOperator]);

  useEffect(() => {
    if (activeTab === "vehicles" && isOperator) {
      fetchVehicles();
    }
  }, [activeTab, isOperator]);

  const fetchOperatorSessions = async () => {
    setLoadingOperatorSessions(true);
    setOperatorSessionsError("");
    
    try {
      const response = await fetch("/api/sessions");
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error fetching operator sessions:", response.status, errorData);
        
        // If it's a 500 server error and there's no other data, don't show error
        // Just show empty state as the likely cause is the user has no sessions
        if (response.status === 500) {
          console.log("Server error occurred, displaying empty sessions state");
          setOperatorSessions([]);
          return;
        }
        
        throw new Error(errorData.error || "Failed to fetch trips");
      }
      
      const data = await response.json();
      
      if (data.sessions && Array.isArray(data.sessions)) {
        // Sort sessions by creation date (newest first)
        const sortedSessions = [...data.sessions].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        // Take only the 5 most recent sessions
        const recentSessions = sortedSessions.slice(0, 5);
        setOperatorSessions(recentSessions);
      } else {
        console.error("Unexpected API response format:", data);
        setOperatorSessions([]);
      }
    } catch (err) {
      console.error("Error fetching operator sessions:", err);
      setOperatorSessionsError("Failed to load trips. Please try again.");
      setOperatorSessions([]);
    } finally {
      setLoadingOperatorSessions(false);
    }
  };

  // Fetch vehicles for the company
  const fetchVehicles = async () => {
    setLoadingVehicles(true);
    setVehiclesError("");
    
    try {
      // Add retry logic for database connection issues
      let retries = 2;
      let response;
      
      while (retries >= 0) {
        try {
          response = await fetch("/api/vehicles");
          break; // If successful, exit the retry loop
        } catch (fetchError) {
          console.error(`Fetch attempt failed (${2-retries}/2):`, fetchError);
          if (retries === 0) throw fetchError;
          retries--;
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!response || !response.ok) {
        const errorData = await response?.json().catch(() => ({}));
        console.error("Error fetching vehicles:", response?.status, errorData);
        
        // Provide more specific error messages based on status code
        if (response?.status === 401) {
          throw new Error("Session expired. Please log in again.");
        } else if (response?.status === 403) {
          throw new Error("You don't have permission to view vehicle records.");
        } else if (response?.status === 500) {
          if (errorData.details && errorData.details.includes("database")) {
            throw new Error("Database connection error. Please try again in a few moments.");
          }
          throw new Error(errorData.error || errorData.details || "Server error. Please try again later.");
        }
        
        throw new Error(errorData.error || "Failed to fetch vehicles");
      }
      
      const data = await response.json();
      
      if (data.vehicles && Array.isArray(data.vehicles)) {
        setVehicles(data.vehicles);
      } else {
        console.error("Unexpected API response format:", data);
        setVehicles([]);
        setVehiclesError("Received invalid data format. Please refresh and try again.");
      }
    } catch (err) {
      console.error("Error fetching vehicles:", err);
      setVehiclesError(err instanceof Error ? err.message : "Failed to load vehicles. Please try again.");
      setVehicles([]);
    } finally {
      setLoadingVehicles(false);
    }
  };

  // Handle vehicle deletion (deactivation)
  const handleDeactivateVehicle = async (vehicleId: string) => {
    if (!confirm("Are you sure you want to deactivate this vehicle? This will mark it as inactive.")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "DELETE"
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to deactivate vehicle");
      }
      
      // Refresh the vehicles list
      fetchVehicles();
      
      // Show success message instead of alert
      showSuccessMessage("Vehicle deactivated successfully");
    } catch (err) {
      console.error("Error deactivating vehicle:", err);
      showErrorMessage(err instanceof Error ? err.message : "Failed to deactivate vehicle. Please try again.");
    }
  };

  // Handle adding a new vehicle
  const handleAddVehicle = async (data: VehicleFormData) => {
    try {
      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add vehicle');
      }
      
      // Refresh vehicles list
      fetchVehicles();
      
      // Show success message instead of alert
      showSuccessMessage('Vehicle added successfully');
    } catch (err) {
      console.error('Error adding vehicle:', err);
      showErrorMessage(err instanceof Error ? err.message : 'Failed to add vehicle. Please try again.');
      throw err; // Re-throw to prevent dialog from closing
    }
  };
  
  // Handle updating a vehicle
  const handleUpdateVehicle = async (data: VehicleFormData) => {
    if (!data.id) {
      showErrorMessage('Cannot update vehicle: Missing ID');
      return;
    }
    
    // Check if we're reactivating an inactive vehicle
    const isReactivation = editingVehicle && 
                          editingVehicle.status === 'INACTIVE' && 
                          data.status === 'ACTIVE';
    
    try {
      const response = await fetch(`/api/vehicles/${data.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update vehicle');
      }
      
      // Refresh vehicles list
      fetchVehicles();
      
      // Show appropriate success message
      if (isReactivation) {
        showSuccessMessage('Vehicle reactivated successfully');
      } else {
        showSuccessMessage('Vehicle updated successfully');
      }
    } catch (err) {
      console.error('Error updating vehicle:', err);
      showErrorMessage(err instanceof Error ? err.message : 'Failed to update vehicle. Please try again.');
      throw err; // Re-throw to prevent dialog from closing
    }
  };
  
  // Generic handler that will call either add or update based on whether we're editing
  const handleSubmitVehicleForm = async (data: VehicleFormData) => {
    if (editingVehicle) {
      await handleUpdateVehicle(data);
    } else {
      await handleAddVehicle(data);
    }
  };

  // Handle trip deletion
  const handleDeleteTrip = async (tripId: string) => {
    if (!confirm("Are you sure you want to delete this trip? This action cannot be undone.")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/sessions/${tripId}`, {
        method: "DELETE"
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete trip");
      }
      
      // Remove the deleted trip from the list
      setOperatorSessions(prev => prev.filter(s => s.id !== tripId));
      
      alert("Trip deleted successfully");
    } catch (err) {
      console.error("Error deleting trip:", err);
      alert(err instanceof Error ? err.message : "Failed to delete trip. Please try again.");
    }
  };

  // Handle opening the delete confirmation modal
  const handleDeleteVehicle = (vehicleId: string) => {
    setVehicleToDelete(vehicleId);
    setDeletePassword("");
    setDeletePasswordError("");
    setDeleteConfirmOpen(true);
  };

  // Handle closing the delete confirmation modal
  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setVehicleToDelete(null);
    setDeletePassword("");
    setDeletePasswordError("");
  };

  // Handle password input change
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeletePassword(e.target.value);
    if (deletePasswordError) {
      setDeletePasswordError("");
    }
  };

  // Handle confirming the deletion with password
  const confirmDeleteVehicle = async () => {
    if (!deletePassword) {
      setDeletePasswordError("Password is required");
      return;
    }

    setIsDeleting(true);
    
    try {
      // Verify the password first
      const verifyResponse = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: deletePassword }),
      });
      
      if (!verifyResponse.ok) {
        throw new Error("Incorrect password");
      }
      
      // If password verification is successful, proceed with deletion
      const deleteResponse = await fetch(`/api/vehicles/${vehicleToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          permanent: true, // This indicates permanent deletion instead of deactivation
        }),
      });
      
      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        throw new Error(errorData.error || "Failed to delete vehicle");
      }
      
      // Close the confirmation dialog
      handleCloseDeleteConfirm();
      
      // Refresh the vehicles list
      fetchVehicles();
      
      // Show success message
      showSuccessMessage("Vehicle deleted successfully");
    } catch (err) {
      console.error("Error deleting vehicle:", err);
      if (err instanceof Error && err.message === "Incorrect password") {
        setDeletePasswordError("Incorrect password");
      } else {
        showErrorMessage(err instanceof Error ? err.message : "Failed to delete vehicle. Please try again.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Call this check when guard dashboard loads if no sessions are found
  useEffect(() => {
    if (isGuard && verificationSessions.length === 0 && !loadingVerifications) {
      // Wait a bit to ensure the normal fetch has completed
      const timer = setTimeout(() => {
        checkAllSessionsForVerification();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isGuard, verificationSessions.length, loadingVerifications, checkAllSessionsForVerification]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:space-x-6">
        {/* Sidebar */}
        <div className="w-full md:w-1/4 mb-6 md:mb-0">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col items-center">
              <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 mb-4">
                <AccountCircle fontSize="large" />
              </div>
              <h2 className="text-xl font-bold">{user.name}</h2>
              <p className="text-gray-600">{user.email}</p>
              <div className="mt-4 flex items-center text-sm text-gray-500">
                <Person fontSize="small" className="mr-1" />
                <span className="capitalize">{user.role?.toLowerCase()} {user.subrole && `(${user.subrole})`}</span>
              </div>
              {user.company && (
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <Apartment fontSize="small" className="mr-1" />
                  <span>{user.company.name}</span>
                </div>
              )}
              {isOperator && (
                <div className="mt-4 flex items-center text-yellow-600 font-bold">
                  <LocalAtm fontSize="small" className="mr-1" />
                  <span>{currentUser?.coins !== undefined ? currentUser.coins : session?.user?.coins || user.coins} Coins</span>
                </div>
              )}
            </div>

            <div className="mt-6">
              <ul>
                <li className="mb-2">
                  <button
                    onClick={() => setActiveTab("profile")}
                    className={`w-full text-left px-4 py-2 rounded-md ${
                      activeTab === "profile"
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Profile
                  </button>
                </li>
                {isOperator && (
                  <li className="mb-2">
                    <button
                      onClick={() => setActiveTab("coins")}
                      className={`w-full text-left px-4 py-2 rounded-md ${
                        activeTab === "coins"
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      Coin Management
                    </button>
                  </li>
                )}
                {isOperator && (
                  <li className="mb-2">
                    <button
                      onClick={() => setActiveTab("trips")}
                      className={`w-full text-left px-4 py-2 rounded-md ${
                        activeTab === "trips"
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      Trip Management
                    </button>
                  </li>
                )}
                {isOperator && (
                  <li className="mb-2">
                    <button
                      onClick={() => setActiveTab("vehicles")}
                      className={`w-full text-left px-4 py-2 rounded-md ${
                        activeTab === "vehicles"
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      Vehicle Records
                    </button>
                  </li>
                )}
                {isGuard && (
                  <li className="mb-2">
                    <button
                      onClick={() => setActiveTab("verifications")}
                      className={`w-full text-left flex justify-between items-center px-4 py-2 rounded-md ${
                        activeTab === "verifications"
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span>Trip Verification</span>
                      {verificationSessions.length > 0 && (
                        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {verificationSessions.length}
                        </span>
                      )}
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="w-full md:w-3/4">
          <div className="bg-white shadow rounded-lg p-6">
            {/* Profile content */}
            {activeTab === "profile" && (
              <div>
                <h3 className="text-lg font-medium mb-4">Profile Information</h3>
                
                {/* Notification for GUARD users when there are trips to verify */}
                {isGuard && (
                  <div className={verificationSessions.length > 0 ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"} 
                       style={{padding: "1rem", borderRadius: "0.375rem", marginBottom: "1rem", display: "flex", alignItems: "center"}}>
                    {verificationSessions.length > 0 ? (
                      <>
                        <CheckCircle color="success" sx={{ fontSize: 20, mr: 1 }} />
                        <div className="flex-1">
                          <p className="font-medium text-green-800">
                            {verificationSessions.length} trip{verificationSessions.length !== 1 ? 's' : ''} awaiting verification
                          </p>
                          <p className="text-sm text-green-700">
                            There are trips ready for your verification. 
                            <button
                              onClick={() => setActiveTab("verifications")}
                              className="ml-2 underline font-medium"
                            >
                              View now
                            </button>
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle color="action" sx={{ fontSize: 20, mr: 1, opacity: 0.5 }} />
                        <div className="flex-1">
                          <p className="font-medium text-gray-700">
                            No trips awaiting verification
                          </p>
                          <p className="text-sm text-gray-600">
                            There are currently no trips that need verification.
                          </p>
                        </div>
                      </>
                    )}
                    <button 
                      onClick={fetchVerificationSessions}
                      className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-md text-sm hover:bg-gray-100 ml-3"
                    >
                      Refresh
                    </button>
                  </div>
                )}
                
                <div className="bg-gray-100 p-6 rounded-md">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Name</h4>
                      <p className="text-gray-900">{user.name}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Email</h4>
                      <p className="text-gray-900">{user.email}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Role</h4>
                      <p className="text-gray-900 capitalize">{user.role?.toLowerCase()}</p>
                    </div>
                    {user.subrole && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Sub-Role</h4>
                        <p className="text-gray-900 capitalize">{formattedSubrole}</p>
                      </div>
                    )}
                    {user.company && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Company</h4>
                        <p className="text-gray-900">{user.company.name}</p>
                      </div>
                    )}
                    {isOperator && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Coins</h4>
                        <p className="text-gray-900">{currentUser?.coins !== undefined ? currentUser.coins : session?.user?.coins || user.coins}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Coins management content */}
            {activeTab === "coins" && isOperator && (
              <div>
                <h3 className="text-lg font-medium mb-4">Coin Management</h3>
                
                <div className="bg-gray-100 p-6 rounded-md mb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium mb-2">Your Coin Balance</h4>
                      <p className="text-3xl font-bold text-yellow-600">
                        {currentUser?.coins !== undefined ? currentUser.coins : session?.user?.coins || user.coins} Coins
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Each session creation costs 1 coin.
                      </p>
                    </div>
                    <button
                      onClick={fetchCurrentUser}
                      className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md text-sm hover:bg-blue-50"
                    >
                      Refresh Balance
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {/* Transaction History */}
                  <div>
                    <h4 className="font-medium mb-2">Transaction History</h4>
                    <TransactionHistory refreshTrigger={refreshTransactions} />
                  </div>
                </div>
              </div>
            )}

            {/* Trip Management content */}
            {activeTab === "trips" && isOperator && (
              <div>
                <h3 className="text-lg font-medium mb-4">Trip Management</h3>
                
                <div className="bg-gray-100 p-6 rounded-md mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium mb-2">Your Trips</h4>
                      <p className="text-sm text-gray-600">Manage your company's transport trips</p>
                    </div>
                    <div className="flex">
                      <button
                        onClick={fetchOperatorSessions}
                        className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md text-sm hover:bg-blue-50 mr-2"
                      >
                        Refresh
                      </button>
                      {operatorPermissions.canCreate && (
                        <Link href="/dashboard/sessions/create">
                          <button className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600">
                            Create New Trip
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {/* Trip List */}
                  <div className="bg-white border rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium">Recent Trips</h4>
                      <Link href="/dashboard/sessions">
                        <button className="px-3 py-1.5 border border-blue-500 text-blue-500 rounded-md text-xs hover:bg-blue-50">
                          View All Trips
                        </button>
                      </Link>
                    </div>
                    
                    {operatorSessionsError && (
                      <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
                        {operatorSessionsError}
                      </div>
                    )}
                    
                    {loadingOperatorSessions ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      </div>
                    ) : operatorSessions.length === 0 ? (
                      <div className="text-center py-10 text-gray-500">
                        <DirectionsCar sx={{ fontSize: 48 }} className="mx-auto mb-4 text-gray-400" />
                        <p className="mb-2">No trips found</p>
                        <p className="text-sm">
                          {operatorPermissions.canCreate 
                            ? "Create a new trip to get started with trip management"
                            : "You don't have permission to create trips. Contact your administrator."}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {operatorSessions.map((operatorSession) => (
                          <div key={operatorSession.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between mb-2">
                              <span className="font-medium">Trip #{operatorSession.id.slice(0, 8)}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                operatorSession.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                                operatorSession.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-800" :
                                "bg-green-100 text-green-800"
                              }`}>
                                {operatorSession.status}
                              </span>
                            </div>
                            
                            <div className="text-sm mb-1">
                              <span className="text-gray-600 mr-1">From:</span> {operatorSession.source}
                            </div>
                            
                            <div className="text-sm mb-1">
                              <span className="text-gray-600 mr-1">To:</span> {operatorSession.destination}
                            </div>
                            
                            <div className="text-sm mb-1">
                              <span className="text-gray-600 mr-1">Created:</span> 
                              {new Date(operatorSession.createdAt).toLocaleDateString()}
                            </div>
                            
                            <div className="flex items-center gap-2 mt-3">
                              <Link href={`/dashboard/sessions/${operatorSession.id}`}>
                                <button className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600">
                                  View Details
                                </button>
                              </Link>
                              
                              {operatorPermissions.canModify && (
                                <Link href={`/dashboard/sessions/${operatorSession.id}/edit`}>
                                  <button className="px-3 py-1.5 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600">
                                    Edit
                                  </button>
                                </Link>
                              )}
                              
                              {operatorPermissions.canDelete && (
                                <button 
                                  onClick={() => handleDeleteTrip(operatorSession.id)}
                                  className="px-3 py-1.5 bg-red-500 text-white rounded-md text-sm hover:bg-red-600"
                                >
                                  Delete
                                </button>
                              )}
                              
                              {operatorSession.status === "PENDING" && !operatorSession.seal && (
                                <Link href={`/dashboard/sessions/${operatorSession.id}`}>
                                  <button className="px-3 py-1.5 border border-green-500 text-green-600 rounded-md text-sm hover:bg-green-50">
                                    Add Seal
                                  </button>
                                </Link>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex justify-center mt-6">
                      <Link href="/dashboard/sessions">
                        <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200">
                          View All Trips
                        </button>
                      </Link>
                    </div>
                  </div>
                  
                  <div className="bg-white border rounded-lg p-6">
                    <h4 className="font-medium mb-4">Your Permissions</h4>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-2 ${operatorPermissions.canCreate ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm">{operatorPermissions.canCreate ? 'You can create new trips' : 'You cannot create new trips'}</span>
                      </div>
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-2 ${operatorPermissions.canModify ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm">{operatorPermissions.canModify ? 'You can modify existing trips' : 'You cannot modify existing trips'}</span>
                      </div>
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-2 ${operatorPermissions.canDelete ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm">{operatorPermissions.canDelete ? 'You can delete trips' : 'You cannot delete trips'}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        These permissions are set by your administrator. Contact them if you need changes.
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white border rounded-lg p-6">
                    <h4 className="font-medium mb-4">Trip Management Process</h4>
                    
                    <div className="space-y-4 mb-6">
                      <div className="flex items-start">
                        <div className="bg-blue-100 text-blue-800 rounded-full h-6 w-6 flex items-center justify-center mr-2 mt-0.5">1</div>
                        <div>
                          <h5 className="font-medium">Create Trip</h5>
                          <p className="text-sm text-gray-600">
                            Enter all required details including vehicle information, materials, and weights.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="bg-blue-100 text-blue-800 rounded-full h-6 w-6 flex items-center justify-center mr-2 mt-0.5">2</div>
                        <div>
                          <h5 className="font-medium">Add Seal</h5>
                          <p className="text-sm text-gray-600">
                            Add a security seal with barcode to the trip once it's ready for transport.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="bg-blue-100 text-blue-800 rounded-full h-6 w-6 flex items-center justify-center mr-2 mt-0.5">3</div>
                        <div>
                          <h5 className="font-medium">Guard Verification</h5>
                          <p className="text-sm text-gray-600">
                            A Guard will verify the seal and complete the trip at the destination.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Vehicle Records content */}
            {activeTab === "vehicles" && isOperator && (
              <div>
                <h3 className="text-lg font-medium mb-4">Vehicle Records</h3>
                
                <div className="bg-gray-100 p-6 rounded-md mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium mb-2">Company Vehicles</h4>
                      <p className="text-sm text-gray-600">Manage your company's vehicle fleet</p>
                    </div>
                    <div className="flex">
                      <button
                        onClick={fetchVehicles}
                        className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md text-sm hover:bg-blue-50 mr-2"
                      >
                        Refresh
                      </button>
                      {operatorPermissions.canCreate && (
                        <button 
                          onClick={() => {
                            setEditingVehicle(null);
                            setVehicleFormOpen(true);
                          }}
                          className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
                        >
                          Add New Vehicle
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {vehiclesError && (
                  <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
                    {vehiclesError}
                  </div>
                )}
                
                {loadingVehicles ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : vehicles.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 bg-white border rounded-lg">
                    <DirectionsCar sx={{ fontSize: 48 }} className="mx-auto mb-4 text-gray-400" />
                    <p className="mb-2">No vehicles found</p>
                    <p className="text-sm">
                      {operatorPermissions.canCreate 
                        ? "Add a new vehicle to start building your fleet"
                        : "You don't have permission to add vehicles. Contact your administrator."}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border rounded-lg p-6">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Number Plate
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Vehicle Details
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Added By
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Added Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {vehicles.map((vehicle) => (
                            <tr key={vehicle.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {vehicle.numberPlate}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {vehicle.manufacturer && vehicle.model ? (
                                  <span>{vehicle.manufacturer} {vehicle.model}{vehicle.yearOfMake ? ` (${vehicle.yearOfMake})` : ''}</span>
                                ) : (
                                  <span className="text-gray-400">No details provided</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  vehicle.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                  vehicle.status === 'MAINTENANCE' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {vehicle.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {vehicle.createdBy?.name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(vehicle.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                {operatorPermissions.canModify && (
                                  <button
                                    onClick={() => {
                                      setEditingVehicle(vehicle);
                                      setVehicleFormOpen(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-900 mr-3"
                                  >
                                    Edit
                                  </button>
                                )}
                                {operatorPermissions.canDelete && vehicle.status !== 'INACTIVE' && (
                                  <button
                                    onClick={() => handleDeactivateVehicle(vehicle.id)}
                                    className="text-yellow-600 hover:text-yellow-900 mr-3"
                                  >
                                    Deactivate
                                  </button>
                                )}
                                {operatorPermissions.canDelete && (
                                  <button
                                    onClick={() => handleDeleteVehicle(vehicle.id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <div className="mt-6 bg-white border rounded-lg p-6">
                  <h4 className="font-medium mb-4">Vehicle Status Guide</h4>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2 bg-green-500"></div>
                      <span className="text-sm">Active - Vehicle is operational and available for use</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2 bg-yellow-500"></div>
                      <span className="text-sm">Maintenance - Vehicle is currently undergoing maintenance</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2 bg-red-500"></div>
                      <span className="text-sm">Inactive - Vehicle is no longer in use or has been deactivated</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Trip Verification content for guards */}
            {activeTab === "verifications" && isGuard && (
              <div>
                <h3 className="text-lg font-medium mb-4">Trip Verification</h3>
                
                <div className="bg-gray-100 p-6 rounded-md mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium mb-2">Trips Awaiting Verification</h4>
                      <p className="text-sm text-gray-600">
                        Verify trip details and seals to complete transport trips
                      </p>
                    </div>
                    <div className="flex gap-2">
                    <button 
                      onClick={fetchVerificationSessions}
                        className="px-4 py-2 border border-blue-500 text-blue-600 rounded-md text-sm hover:bg-blue-50"
                    >
                      Refresh
                    </button>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {verificationError && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
                      {verificationError}
                    </div>
                  )}
                  
                  {loadingVerifications ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : verificationSessions.length === 0 ? (
                    <div className="bg-white border rounded-lg p-6 text-center py-10 text-gray-500">
                      <DirectionsCar sx={{ fontSize: 48 }} className="mx-auto mb-4 text-gray-400" />
                      <p className="mb-2">No trips awaiting verification</p>
                      <p className="text-sm">
                        All trips have been verified or there are no trips in progress.
                      </p>
                      
                      <div className="flex justify-center mt-4">
                        <Link href="/dashboard/sessions?status=IN_PROGRESS">
                          <button className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md text-sm hover:bg-blue-50">
                            View All In-Progress Trips
                          </button>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Session Cards */}
                      <div className="bg-white border rounded-lg p-6">
                        <h4 className="font-medium mb-4">Trips Ready for Verification ({verificationSessions.length})</h4>
                        
                        <div className="space-y-4">
                          {verificationSessions.map((verificationSession) => (
                            <div key={verificationSession.id} className="border rounded-lg p-4 bg-green-50 border-green-100">
                              <div className="flex justify-between mb-2">
                                <span className="font-medium">Trip #{verificationSession.id.slice(0, 8)}</span>
                                <span className="text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full text-xs">
                                  {verificationSession.status}
                                </span>
                              </div>
                              
                              <div className="text-sm mb-1">
                                <span className="text-gray-600 mr-1">From:</span> {verificationSession.source}
                              </div>
                              
                              <div className="text-sm mb-1">
                                <span className="text-gray-600 mr-1">To:</span> {verificationSession.destination}
                              </div>
                              
                              <div className="text-sm mb-1">
                                <span className="text-gray-600 mr-1">Company:</span> {verificationSession.company.name}
                              </div>
                              
                              {verificationSession.seal && (
                                <div className="text-sm mb-2">
                                  <span className="text-gray-600 mr-1">Seal:</span> {verificationSession.seal.barcode}
                                </div>
                              )}
                              
                              <div className="flex justify-between items-center mt-3">
                                <Link href={`/dashboard/sessions/${verificationSession.id}`}>
                                  <button className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600">
                                    View Details
                                  </button>
                                </Link>
                                
                                <div className="text-green-700 flex items-center text-sm">
                                  <CheckCircle fontSize="small" className="mr-1" />
                                  Ready to verify
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="bg-white border rounded-lg p-6">
                        <h4 className="font-medium mb-4">Verification Process</h4>
                        
                        <div className="space-y-4 mb-6">
                          <div className="flex items-start">
                            <div className="bg-blue-100 text-blue-800 rounded-full h-6 w-6 flex items-center justify-center mr-2 mt-0.5">1</div>
                            <div>
                              <h5 className="font-medium">View Trip Details</h5>
                              <p className="text-sm text-gray-600">
                                Check all trip details entered by the operator, including vehicle information, materials, and weights.
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start">
                            <div className="bg-blue-100 text-blue-800 rounded-full h-6 w-6 flex items-center justify-center mr-2 mt-0.5">2</div>
                            <div>
                              <h5 className="font-medium">Verify Physical Seal</h5>
                              <p className="text-sm text-gray-600">
                                Confirm the physical seal matches the barcode in the system and is properly applied.
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start">
                            <div className="bg-blue-100 text-blue-800 rounded-full h-6 w-6 flex items-center justify-center mr-2 mt-0.5">3</div>
                            <div>
                              <h5 className="font-medium">Complete Verification</h5>
                              <p className="text-sm text-gray-600">
                                Click "Verify Seal" to mark the trip as verified and complete the transport process.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Vehicle Form Dialog */}
      <VehicleForm 
        open={vehicleFormOpen}
        onClose={() => setVehicleFormOpen(false)}
        onSubmit={handleSubmitVehicleForm}
        initialData={editingVehicle}
        isEditing={!!editingVehicle}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={!isDeleting ? handleCloseDeleteConfirm : undefined}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Confirm Vehicle Deletion
            {!isDeleting && (
              <IconButton onClick={handleCloseDeleteConfirm} size="small">
                <Close />
              </IconButton>
            )}
          </div>
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            You are about to permanently delete this vehicle. This action cannot be undone.
          </Typography>
          
          <Typography variant="body1" sx={{ mt: 2, mb: 2 }} color="error">
            For security, please enter your password to confirm deletion:
          </Typography>
          
          <TextField
            type="password"
            label="Your Password"
            fullWidth
            value={deletePassword}
            onChange={handlePasswordChange}
            error={!!deletePasswordError}
            helperText={deletePasswordError}
            disabled={isDeleting}
            autoComplete="current-password"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={handleCloseDeleteConfirm} 
            disabled={isDeleting}
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmDeleteVehicle} 
            variant="contained" 
            color="error"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Vehicle'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
} 