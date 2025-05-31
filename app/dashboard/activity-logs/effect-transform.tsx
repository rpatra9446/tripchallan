"use client";

import { useState, useEffect } from 'react';
import { ActivityLog, ActivityLogRow } from './types';

/**
 * Custom hook to transform raw ActivityLog data into the format needed for display
 * 
 * @param logs The raw logs from the API
 * @returns An object containing the transformed table data and setter
 */
export const useTransformLogs = (logs: ActivityLog[] | null | undefined) => {
  const [tableData, setTableData] = useState<ActivityLogRow[]>([]);

  useEffect(() => {
    console.log("Transform effect running. Logs:", logs?.length || 0);
    
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      console.log("No logs to transform");
      setTableData([]);
      return;
    }
    
    try {
      const formattedData = logs.map(log => {
        try {
          if (!log) {
            console.warn("Encountered null log entry");
            return null;
          }
          
          return {
            id: log.id || `unknown-${Math.random()}`,
            user: {
              name: log.user?.name || "Unknown User",
              email: log.user?.email || "No email"
            },
            action: log.action || "UNKNOWN",
            details: {
              ...(log.details || {}),
              // Handle amount specially to ensure consistent format
              amount: log.details?.amount !== undefined 
                ? (typeof log.details.amount === 'string' 
                  ? log.details.amount 
                  : String(log.details.amount))
                : undefined
            },
            targetUser: log.targetUser
              ? {
                  name: log.targetUser.name || "Unknown",
                  email: log.targetUser.email || "No email"
                }
              : undefined,
            createdAt: log.createdAt || new Date().toISOString(),
            userAgent: log.userAgent || undefined,
            targetResourceType: log.targetResourceType === "USER_LIST" ? "Resources" : (log.targetResourceType || " - ")
          };
        } catch (itemError) {
          console.error("Error processing log item:", itemError);
          return null;
        }
      }).filter(Boolean) as ActivityLogRow[];
      
      console.log("Successfully transformed", formattedData.length, "log entries");
      setTableData(formattedData);
    } catch (error) {
      console.error("Error in logs transformation:", error);
      setTableData([]);
    }
  }, [logs]);

  // Return both the transformed data and setter so callers can update it if needed
  return { tableData, setTableData };
};

/**
 * Function to extract unique filter options from transformed log data
 * 
 * @param data The transformed table data
 * @returns Object containing arrays of unique actions, users, and resource types
 */
export const extractFilterOptions = (data: ActivityLogRow[]) => {
  if (!data || data.length === 0) {
    return {
      actions: [],
      users: [],
      resourceTypes: []
    };
  }

  try {
    // Extract unique actions
    const actions = Array.from(new Set(data.map(item => item.action)));
    
    // Extract unique users
    const users = data.reduce((acc, item) => {
      const userKey = `${item.user.email}`;
      if (!acc.some(u => u.email === item.user.email)) {
        acc.push(item.user);
      }
      return acc;
    }, [] as {name: string, email: string}[]);
    
    // Extract unique resource types
    const resourceTypes = Array.from(new Set(data
      .map(item => item.targetResourceType)
      .filter(Boolean) as string[]
    ));
    
    return { actions, users, resourceTypes };
  } catch (error) {
    console.error("Error extracting filter options:", error);
    return {
      actions: [],
      users: [],
      resourceTypes: []
    };
  }
};

export default useTransformLogs; 