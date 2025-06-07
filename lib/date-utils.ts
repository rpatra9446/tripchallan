import { format as fnsFormat } from 'date-fns';

/**
 * Formats a timestamp in the exact "Jan 15, 2024 14:30:22" format as required by the spec
 * @param date The date to format
 * @returns Formatted date string in "Jan 15, 2024 14:30:22" format
 */
export function formatTimestampExact(date: Date | string): string {
  if (!date) return 'N/A';
  
  try {
    const d = new Date(date);
    
    // Check if date is valid
    if (isNaN(d.getTime())) {
      return 'N/A';
    }
    
    // Format as "Jan 15, 2024 14:30:22"
    return fnsFormat(d, 'MMM d, yyyy HH:mm:ss');
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return 'N/A';
  }
}

/**
 * Parses a timestamp from various formats
 * @param timestamp The timestamp string to parse
 * @returns A Date object representing the timestamp
 */
export function parseTimestamp(timestamp: string): Date | null {
  if (!timestamp) return null;
  
  try {
    // Try parsing as ISO string
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // If not valid, try other formats or return null
    return null;
  } catch (error) {
    console.error('Error parsing timestamp:', error);
    return null;
  }
}

/**
 * Formats a date for display with a default format
 * @param date The date to format
 * @param formatStr Optional format string for date-fns
 * @returns Formatted date string
 */
export function formatDate(date: Date | string, formatStr: string = 'MMM d, yyyy'): string {
  if (!date) return 'N/A';
  
  try {
    const d = new Date(date);
    
    // Check if date is valid
    if (isNaN(d.getTime())) {
      return 'N/A';
    }
    
    // Format using the provided format string or default
    return fnsFormat(d, formatStr);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'N/A';
  }
} 