"use client";

import { useState, useEffect } from 'react';

interface CompanyLogoProps {
  logoId: string | null | undefined;
  companyName: string;
}

export default function CompanyLogo({ logoId, companyName }: CompanyLogoProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  // Get first letter for the avatar (fallback)
  const firstLetter = companyName?.charAt(0)?.toUpperCase() || "C";
  
  // Generate a consistent background color based on company name
  const getBgColor = () => {
    if (!companyName) return "#f0f0f0";
    
    // Simple hash function for the company name
    let hash = 0;
    for (let i = 0; i < companyName.length; i++) {
      hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert to RGB color - pastel range
    const r = ((hash & 0xFF0000) >> 16) % 200 + 55;  // 55-255
    const g = ((hash & 0x00FF00) >> 8) % 200 + 55;   // 55-255
    const b = (hash & 0x0000FF) % 200 + 55;          // 55-255
    
    return `rgb(${r}, ${g}, ${b})`;
  };
  
  useEffect(() => {
    const fetchLogo = async () => {
      if (!logoId) {
        setLogoUrl(null);
        return;
      }
      
      try {
        setLoading(true);
        const response = await fetch(`/api/media?id=${logoId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch logo: ${response.status}`);
        }
        
        const data = await response.json();
        setLogoUrl(data.dataUrl);
      } catch (err) {
        console.error("Error fetching logo:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLogo();
  }, [logoId]);
  
  const handleImageError = () => {
    console.error("Image failed to load:", logoUrl);
    setError(true);
  };
  
  // Show loading state
  if (loading) {
    return (
      <div className="w-40 h-40 border rounded-md overflow-hidden flex items-center justify-center bg-gray-100">
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }
  
  // Show letter avatar as fallback
  if (!logoUrl || error) {
    return (
      <div 
        className="w-40 h-40 border rounded-md overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: getBgColor() }}
      >
        <span className="text-white text-6xl font-bold">{firstLetter}</span>
      </div>
    );
  }
  
  // Show actual logo
  return (
    <div className="w-40 h-40 border rounded-md overflow-hidden">
      <img 
        src={logoUrl}
        alt={`${companyName} logo`}
        className="w-full h-full object-contain"
        onError={handleImageError}
      />
    </div>
  );
} 