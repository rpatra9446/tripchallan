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
 * Gets and formats the timestamp for a field in a session
 * Uses the highest priority source: formattedFieldTimestamps > fieldTimestamps > legacy timestamps > session creation time
 * 
 * @param session The session object containing timestamp information
 * @param key The field name to get the timestamp for
 * @returns Formatted timestamp string
 */
export function getSessionFieldTimestamp(session: any, key: string): string {
  if (!session) return 'N/A';
  
  try {
    // For image fields that start with 'images.', extract the actual field name for legacy lookup
    const isImageField = key.startsWith('images.');
    const imageFieldName = isImageField ? key.replace('images.', '') : null;
    
    // Find timestamp for this field if available
    const fieldTimestamp = session.fieldTimestamps?.find(
      (ft: any) => ft.fieldName === key || 
                  ft.fieldName === `loadingDetails.${key}` || 
                  ft.fieldName === `driverDetails.${key}`
    );
    
    // Check for formatted timestamps (new API response format)
    const formattedTimestamp = 
      session.formattedFieldTimestamps?.[key] || 
      session.formattedFieldTimestamps?.[`loadingDetails.${key}`] ||
      session.formattedFieldTimestamps?.[`driverDetails.${key}`];
    
    // Fallback to legacy timestamps if formatted timestamps are not available
    let legacyTimestamp;
    
    // Check if it's an image field for specific handling
    if (isImageField && imageFieldName && session.timestamps?.imagesForm) {
      legacyTimestamp = session.timestamps.imagesForm[imageFieldName];
    } else if (session.timestamps?.loadingDetails && 
              session.timestamps.loadingDetails[key]) {
      legacyTimestamp = session.timestamps.loadingDetails[key];
    } else if (session.timestamps?.imagesForm && 
              session.timestamps.imagesForm[key]) {
      legacyTimestamp = session.timestamps.imagesForm[key];
    }
    
    // Return the timestamp with the highest priority: formatted > fieldTimestamp > legacyTimestamp > session creation time
    if (formattedTimestamp) {
      return formattedTimestamp.formattedTimestamp;
    } else if (fieldTimestamp) {
      return formatTimestampExact(fieldTimestamp.timestamp);
    } else if (legacyTimestamp) {
      return formatTimestampExact(legacyTimestamp);
    } else if (session.createdAt) {
      return formatTimestampExact(session.createdAt);
    } else {
      return formatTimestampExact(new Date());
    }
  } catch (error) {
    console.error('Error getting field timestamp:', error, { key });
    return formatTimestampExact(new Date());
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