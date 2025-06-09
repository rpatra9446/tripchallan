import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

// Helper function to format dates
const formatDate = (dateString: string | Date) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return 'Invalid date';
  }
};

// Generate PDF report for session
export const GET = withAuth(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    try {
      if (!context?.params?.id) {
        return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
      }

      const session = await getServerSession(authOptions);
      const userRole = session?.user.role;
      const userId = session?.user.id;
      const sessionId = context.params.id;
      
      // Fetch session data with all related information
      const sessionData = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          seal: {
            include: {
              verifiedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
          comments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 5,
          },
          // Include all tags and detailed information
          sealTags: true,
          guardSealTags: true,
        },
      });

      if (!sessionData) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      // Fetch activity logs to get images and other data
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          targetResourceId: sessionId,
          targetResourceType: 'session',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Extract trip details from activity logs
      interface TripDetails {
        freight?: number;
        doNumber?: string;
        tpNumber?: string;
        driverName?: string;
        loaderName?: string;
        tareWeight?: number;
        grossWeight?: number;
        materialName?: number;
        gpsImeiNumber?: string;
        vehicleNumber?: string;
        transporterName?: string;
        receiverPartyName?: string;
        loaderMobileNumber?: string;
        qualityOfMaterials?: string;
        driverContactNumber?: string;
        challanRoyaltyNumber?: string;
        driverLicense?: string;
      }

      // Start with sessionData fields for fallback
      let tripDetails: TripDetails = {
        freight: sessionData.freight as number | undefined,
        vehicleNumber: sessionData.vehicleNumber,
        driverName: sessionData.driverName,
        driverContactNumber: sessionData.driverContactNumber,
        transporterName: sessionData.transporterName,
      };
      
      // Extract tripDetails from activity logs
      for (const log of activityLogs) {
        if (!log.details) continue;
        
        let details: any;
        if (typeof log.details === 'string') {
          try {
            details = JSON.parse(log.details);
          } catch (e) {
            continue;
          }
        } else {
          details = log.details;
        }

        // Try to extract trip details from various possible locations
        if (details?.tripDetails) {
          tripDetails = { ...tripDetails, ...details.tripDetails };
        } else if (details?.data?.tripDetails) {
          tripDetails = { ...tripDetails, ...details.data.tripDetails };
        } else if (details?.data) {
          // If tripDetails are directly in the data object
          const possibleTripData = details.data;
          
          // Extract relevant fields if they exist
          const fieldsToCopy = [
            'freight', 'doNumber', 'tpNumber', 'driverName', 'loaderName', 
            'tareWeight', 'grossWeight', 'materialName', 'gpsImeiNumber', 
            'vehicleNumber', 'transporterName', 'receiverPartyName', 
            'loaderMobileNumber', 'qualityOfMaterials', 'driverContactNumber', 
            'challanRoyaltyNumber', 'driverLicense'
          ];
          
          fieldsToCopy.forEach(field => {
            if (possibleTripData[field] !== undefined) {
              (tripDetails as any)[field] = possibleTripData[field];
            }
          });
        }
      }

      // Extract images from activity logs
      let images: {
        driverPicture?: string;
        vehicleNumberPlatePicture?: string;
        gpsImeiPicture?: string;
        sealingImages: string[];
        vehicleImages: string[];
        additionalImages: string[];
      } = {
        sealingImages: [],
        vehicleImages: [],
        additionalImages: []
      };

      // Extract image data from activity logs
      for (const log of activityLogs) {
        if (!log.details) continue;
        
        let details: any;
        if (typeof log.details === 'string') {
          try {
            details = JSON.parse(log.details);
          } catch (e) {
            continue;
          }
        } else {
          details = log.details;
        }

        if (details?.imageBase64Data) {
          const imageData = details.imageBase64Data;
          
          // Extract single images
          ['driverPicture', 'vehicleNumberPlatePicture', 'gpsImeiPicture'].forEach(key => {
            if (imageData[key]?.data && !images[key as keyof typeof images]) {
              const contentType = imageData[key].contentType || 'image/jpeg';
              (images as any)[key] = `data:${contentType};base64,${imageData[key].data}`;
            }
          });
          
          // Extract image arrays
          ['sealingImages', 'vehicleImages', 'additionalImages'].forEach(key => {
            if (Array.isArray(imageData[key])) {
              imageData[key].forEach((img: any, index: number) => {
                if (img?.data) {
                  const contentType = img.contentType || 'image/jpeg';
                  (images as any)[key][index] = `data:${contentType};base64,${img.data}`;
                }
              });
            }
          });
          
          // Extract seal tag images
          if (imageData.sealTagImages) {
            Object.keys(imageData.sealTagImages).forEach(barcode => {
              const img = imageData.sealTagImages[barcode];
              if (img?.data) {
                // Find matching seal tag and add image data
                const sealTag = sessionData.sealTags?.find(tag => tag.barcode === barcode);
                if (sealTag) {
                  const contentType = img.contentType || 'image/jpeg';
                  // Use type assertion to fix null assignment issue
                  (sealTag as any).imageData = `data:${contentType};base64,${img.data}`;
                }
              }
            });
          }
        }
      }

      // Check authorization
      if (![UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY].includes(userRole as UserRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      if (userRole === UserRole.COMPANY && userId !== sessionData.companyId) {
        return NextResponse.json(
          { error: "Unauthorized - You can only download reports for your own sessions" },
          { status: 403 }
        );
      }

      // Create PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Enhanced color palette for better visual appeal
      const primaryColor = [63, 81, 181]; // Material UI blue
      const primaryLightColor = [121, 134, 203]; // Lighter primary for gradients
      const secondaryColor = [255, 152, 0]; // Vibrant orange for accents
      const secondaryLightColor = [255, 183, 77]; // Lighter secondary
      const successColor = [46, 125, 50]; // Rich green
      const warningColor = [237, 108, 2]; // Bold amber
      const errorColor = [211, 47, 47]; // Vivid red
      const darkGray = [51, 51, 51]; // For main text
      const grayColor = [97, 97, 97]; // For secondary text
      const lightGray = [224, 224, 224]; // For borders
      const bgLightGray = [245, 245, 245]; // For backgrounds
      const white = [255, 255, 255]; // Pure white

      // Page dimensions and margins
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;

      // Add professional document metadata
      doc.setProperties({
        title: `Trip Session Report - ${sessionData.id}`,
        subject: 'Trip Monitoring Report',
        author: 'TripNeon System',
        keywords: 'trip, logistics, seal, verification, tracking',
        creator: 'TripNeon'
      });

      // Create a visually striking cover page
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Add logo placeholder or company name with elegant styling
      const logoHeight = 25;
      doc.setFillColor(...white);
      doc.roundedRect(margin, 40, pageWidth - (margin * 2), logoHeight * 2, 4, 4, 'F');

      doc.setTextColor(...primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text(sessionData.company?.name || 'Company Report', pageWidth / 2, 40 + (logoHeight / 2) + 10, { align: 'center' });

      // Add report title with professional styling
      doc.setFillColor(...white);
      doc.roundedRect(margin, 100, pageWidth - (margin * 2), 50, 4, 4, 'F');

      doc.setTextColor(...darkGray);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('SESSION REPORT', pageWidth / 2, 120, { align: 'center' });

      doc.setFontSize(16);
      doc.text(sessionData.id, pageWidth / 2, 140, { align: 'center' });

      // Add timestamp with elegant styling
      doc.setFillColor(...white, 0.9);
      doc.roundedRect(margin, 170, pageWidth - (margin * 2), 20, 2, 2, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...grayColor);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 183, { align: 'center' });

      // Add session status with visual indicator
      const statusY = 210;
      let statusColor;
      switch (sessionData.status) {
        case 'COMPLETED':
          statusColor = successColor;
          break;
        case 'IN_PROGRESS':
          statusColor = warningColor;
          break;
        case 'CANCELLED':
          statusColor = errorColor;
          break;
        default:
          statusColor = grayColor;
      }

      doc.setFillColor(...white);
      doc.roundedRect(pageWidth / 2 - 50, statusY, 100, 30, 4, 4, 'F');

      doc.setFillColor(...statusColor, 0.2);
      doc.roundedRect(pageWidth / 2 - 45, statusY + 5, 90, 20, 4, 4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...statusColor);
      doc.setFontSize(12);
      doc.text(sessionData.status, pageWidth / 2, statusY + 18, { align: 'center' });

      // Add source to destination info with visual representation
      const routeY = 260;
      doc.setFillColor(...white);
      doc.roundedRect(margin, routeY, pageWidth - (margin * 2), 40, 4, 4, 'F');

      // Source
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.setFontSize(10);
      doc.text('SOURCE', margin + 30, routeY + 15, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkGray);
      doc.setFontSize(12);
      doc.text(sessionData.source || 'N/A', margin + 30, routeY + 28, { align: 'center' });

      // Arrow in the middle
      doc.setDrawColor(...secondaryColor);
      doc.setLineWidth(1.5);
      doc.line(pageWidth/2 - 30, routeY + 20, pageWidth/2 + 30, routeY + 20);
      // Arrow head
      doc.setFillColor(...secondaryColor);
      doc.triangle(
        pageWidth/2 + 30, routeY + 20,
        pageWidth/2 + 25, routeY + 15,
        pageWidth/2 + 25, routeY + 25
      );

      // Destination
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.setFontSize(10);
      doc.text('DESTINATION', pageWidth - margin - 30, routeY + 15, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkGray);
      doc.setFontSize(12);
      doc.text(sessionData.destination || 'N/A', pageWidth - margin - 30, routeY + 28, { align: 'center' });

      // Add created by info at the bottom
      const createdByY = 320;
      doc.setFillColor(...white);
      doc.roundedRect(margin, createdByY, pageWidth - (margin * 2), 30, 4, 4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.setFontSize(10);
      doc.text('CREATED BY', margin + 10, createdByY + 12);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkGray);
      doc.setFontSize(12);
      doc.text(sessionData.createdBy?.name || 'N/A', margin + 70, createdByY + 12);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.setFontSize(10);
      doc.text('DATE', margin + 10, createdByY + 22);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkGray);
      doc.setFontSize(12);
      doc.text(formatDate(sessionData.createdAt), margin + 70, createdByY + 22);

      // Add a stylish footer with page indicators
      const footerY = pageHeight - 20;
      doc.setFillColor(...primaryColor);
      doc.rect(0, footerY, pageWidth, 20, 'F');

      doc.setTextColor(...white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('TripNeon Session Report', pageWidth / 2, footerY + 13, { align: 'center' });

      // Add a new page for the content
      doc.addPage();

      // Add footer to all pages with page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(...primaryColor);
        doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        
        doc.setTextColor(...white);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(
          `Page ${i} of ${totalPages} | Generated on: ${new Date().toLocaleString()} | TripNeon Report System`,
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        );
      }

      // Start content on page 2
      doc.setPage(2);
      let yPos = 15;

      // Add section header with gradient effect
      const addSectionHeader = (title, currentYPos, icon = '') => {
        // Create gradient background
        doc.setFillColor(...primaryColor, 0.15);
        doc.roundedRect(margin, currentYPos, pageWidth - margin * 2, 14, 3, 3, 'F');
        
        // Add left border accent
        doc.setFillColor(...primaryColor);
        doc.rect(margin, currentYPos, 5, 14, 'F');
        
        // Add title text
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.setFontSize(12);
        doc.text(title, margin + 10, currentYPos + 10);
        
        return currentYPos + 20;
      };

      // Enhanced field display function
      const addField = (label, value, currentXPos, currentYPos, width) => {
        // Label with styling
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.setFontSize(9);
        doc.text(label, currentXPos, currentYPos);
        
        // Value with better formatting
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...darkGray);
        doc.setFontSize(10);
        
        // Handle long text with wrapping
        const textLines = doc.splitTextToSize(value || 'N/A', width - 10);
        
        // Add subtle background for value
        const textHeight = 5 + (textLines.length * 5);
        doc.setFillColor(...bgLightGray);
        doc.roundedRect(currentXPos, currentYPos + 2, width - 10, textHeight, 2, 2, 'F');
        
        // Add text
        doc.text(textLines, currentXPos + 2, currentYPos + 6);
        
        return currentYPos + 8 + (textLines.length * 5);
      };

      // Enhanced status badge function
      const addStatusBadge = (status, currentXPos, currentYPos) => {
        let color;
        switch (status) {
          case 'COMPLETED':
            color = successColor;
            break;
          case 'IN_PROGRESS':
            color = warningColor;
            break;
          case 'CANCELLED':
            color = errorColor;
            break;
          default:
            color = grayColor;
        }
        
        const textWidth = doc.getTextWidth(status) + 14;
        
        // Draw badge with gradient effect
        doc.setFillColor(...color, 0.2);
        doc.roundedRect(currentXPos, currentYPos - 5, textWidth, 8, 4, 4, 'F');
        
        // Add accent on left
        doc.setFillColor(...color);
        doc.rect(currentXPos, currentYPos - 5, 3, 8, 'F');
        
        // Draw badge text
        doc.setTextColor(...color);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(status, currentXPos + 7, currentYPos);
        
        return textWidth;
      };

      // Trip Details Section with modern design
      if (sessionData.tripDetails && Object.keys(sessionData.tripDetails).length > 0) {
        yPos = addSectionHeader('TRIP DETAILS', yPos);
        
        // Create a modern card container with subtle shadow
        // Shadow effect
        doc.setFillColor(...lightGray);
        doc.roundedRect(margin + 2, yPos + 2, pageWidth - margin * 2 - 2, 75, 4, 4, 'F');
        
        // Card
        doc.setFillColor(...white);
        doc.setDrawColor(...lightGray);
        doc.roundedRect(margin, yPos, pageWidth - margin * 2, 75, 4, 4, 'FD');
        
        // Organize trip details in a grid
        const details = sessionData.tripDetails;
        const fieldWidth = (pageWidth - margin * 2 - 10) / 3;
        
        let fieldYPos = yPos + 10;
        let fieldXPos = margin + 5;
        
        // First row with visual indicators for key fields
        fieldYPos = addField('Transporter', details.transporterName || 'N/A', fieldXPos, fieldYPos, fieldWidth);
        fieldXPos += fieldWidth;
        fieldYPos = Math.max(fieldYPos, addField('Material', details.materialName || 'N/A', fieldXPos, fieldYPos, fieldWidth));
        fieldXPos += fieldWidth;
        fieldYPos = Math.max(fieldYPos, addField('Vehicle Number', details.vehicleNumber || 'N/A', fieldXPos, fieldYPos, fieldWidth));
        
        // Second row
        fieldYPos += 5;
        fieldXPos = margin + 5;
        fieldYPos = addField('Driver Name', details.driverName || 'N/A', fieldXPos, fieldYPos, fieldWidth);
        fieldXPos += fieldWidth;
        fieldYPos = Math.max(fieldYPos, addField('Driver Contact', details.driverContactNumber || 'N/A', fieldXPos, fieldYPos, fieldWidth));
        fieldXPos += fieldWidth;
        fieldYPos = Math.max(fieldYPos, addField('Driver License', details.driverLicense || 'N/A', fieldXPos, fieldYPos, fieldWidth));
        
        // Adjust the card height based on content
        const cardHeight = fieldYPos - yPos + 10;
        // Redraw the card with the proper height
        doc.setFillColor(...lightGray);
        doc.roundedRect(margin + 2, yPos + 2, pageWidth - margin * 2 - 2, cardHeight, 4, 4, 'F');
        doc.setFillColor(...white);
        doc.roundedRect(margin, yPos, pageWidth - margin * 2, cardHeight, 4, 4, 'FD');
        
        yPos = fieldYPos + 15;
      }

      // Enhanced table styling
      const tableStyles = {
        headStyles: {
          fillColor: primaryColor,
          textColor: white,
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 9,
          lineColor: [240, 240, 240]
        },
        alternateRowStyles: {
          fillColor: [248, 248, 250]
        },
        columnStyles: {
          0: { fontStyle: 'bold' }
        },
        margin: { top: 5 },
        styles: { 
          cellPadding: 4,
          lineWidth: 0.1,
          lineColor: [220, 220, 220]
        },
        theme: 'grid'
      };

      // Function to create elegant image cards
      const createImageCard = (xPos, yPos, imgWidth, imgHeight, imageUrl, title, subtitle = null) => {
        // Shadow effect
        doc.setFillColor(...lightGray);
        doc.roundedRect(xPos + 2, yPos + 2, imgWidth, imgHeight + 20, 4, 4, 'F');
        
        // Card container
        doc.setFillColor(...white);
        doc.setDrawColor(...lightGray);
        doc.roundedRect(xPos, yPos, imgWidth, imgHeight + 20, 4, 4, 'FD');
        
        try {
          // Add image
          doc.addImage(
            imageUrl,
            'AUTO',
            xPos + 5,
            yPos + 5,
            imgWidth - 10,
            imgHeight - 5,
            undefined,
            'FAST',
            0
          );
          
          // Add caption with gradient background
          doc.setFillColor(...primaryLightColor, 0.1);
          doc.roundedRect(xPos, yPos + imgHeight, imgWidth, 20, 0, 0, 'F');
          
          // Title
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...primaryColor);
          doc.setFontSize(8);
          doc.text(title, xPos + (imgWidth/2), yPos + imgHeight + 8, { align: 'center' });
          
          // Subtitle if provided
          if (subtitle) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...grayColor);
            doc.setFontSize(7);
            doc.text(subtitle, xPos + (imgWidth/2), yPos + imgHeight + 15, { align: 'center' });
          }
        } catch (err) {
          console.error(`Error adding image to card:`, err);
          
          // Error placeholder
          doc.setFillColor(...bgLightGray);
          doc.roundedRect(xPos + 5, yPos + 5, imgWidth - 10, imgHeight - 5, 2, 2, 'F');
          
          doc.setTextColor(...grayColor);
          doc.setFontSize(8);
          doc.text('Image not available', xPos + (imgWidth/2), yPos + (imgHeight/2), { align: 'center' });
          
          // Still add the caption
          doc.setFillColor(...primaryLightColor, 0.1);
          doc.roundedRect(xPos, yPos + imgHeight, imgWidth, 20, 0, 0, 'F');
          
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...primaryColor);
          doc.setFontSize(8);
          doc.text(title, xPos + (imgWidth/2), yPos + imgHeight + 8, { align: 'center' });
          
          if (subtitle) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...grayColor);
            doc.setFontSize(7);
            doc.text(subtitle, xPos + (imgWidth/2), yPos + imgHeight + 15, { align: 'center' });
          }
        }
      };

      // Operator Seal Tags with beautiful design
      if (sessionData.sealTags && sessionData.sealTags.length > 0) {
        yPos = Math.max(yPos, (doc as any).lastAutoTable?.finalY || 0) + 15;
        yPos = addSectionHeader('OPERATOR SEAL TAGS', yPos);
        
        // Add info box before table
        doc.setFillColor(...bgLightGray);
        doc.roundedRect(margin, yPos, pageWidth - margin * 2, 15, 3, 3, 'F');
        
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...grayColor);
        doc.setFontSize(9);
        doc.text(`${sessionData.sealTags.length} seal tags applied by operator`, margin + 10, yPos + 10);
        
        yPos += 20;

        // Prepare rows with barcode, method, and timestamp
        const sealTagRows = sessionData.sealTags.map(tag => [
          tag.barcode || 'N/A',
          tag.method || 'N/A',
          tag.createdAt ? formatDate(tag.createdAt) : 'N/A'
        ]);

        // Create table with improved styling
        autoTable(doc, {
          startY: yPos,
          head: [['Barcode', 'Method', 'Applied At']],
          body: sealTagRows,
          ...tableStyles,
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 60 },
            1: { cellWidth: 60 },
            2: { cellWidth: 60 }
          }
        });

        // After the table, add operator seal images in a grid layout
        console.log(`Processing ${sessionData.sealTags.length} operator seal tags`);
        
        // Filter out tags with images
        const sealTagsWithImages = sessionData.sealTags.filter(tag => 
          tag.imageUrl || tag.imageData || (tag as any).image
        );
        
        console.log(`Found ${sealTagsWithImages.length} operator seal tags with potential images`);
        
        if (sealTagsWithImages.length > 0) {
          yPos = (doc as any).lastAutoTable.finalY + 15;
          yPos = addSectionHeader('OPERATOR SEAL IMAGES', yPos);
          
          // Set up improved image grid with better spacing
          const imgWidth = 55;
          const imgHeight = 55;
          const imgsPerRow = 3;
          const spacing = 15;
          let xPos = margin;
          
          let successfulImages = 0;
          
          sealTagsWithImages.forEach((tag, index) => {
            try {
              // Try all possible ways to get the image
              const imageUrl = tryGetImageData(tag);
              
              if (imageUrl === undefined) {
                console.log(`No image data found for operator seal tag ${tag.barcode}`);
                return; // Skip this tag
              }
              
              // Create elegant image card
              createImageCard(
                xPos, 
                yPos, 
                imgWidth, 
                imgHeight, 
                imageUrl, 
                tag.barcode,
                tag.method
              );
              
              successfulImages++;
              
              // Move to next position
              xPos += imgWidth + spacing;
              
              // If end of row, move to next row
              if ((index + 1) % imgsPerRow === 0) {
                xPos = margin;
                yPos += imgHeight + spacing + 15;
              }
              
              // If near bottom of page, add new page
              if (yPos > doc.internal.pageSize.height - 40) {
                doc.addPage();
                yPos = 15;
                xPos = margin;
                
                yPos = addSectionHeader('OPERATOR SEAL IMAGES (CONTINUED)', yPos);
              }
            } catch (err) {
              console.error(`Error processing operator seal image:`, err);
            }
          });
          
          console.log(`Successfully added ${successfulImages} of ${sealTagsWithImages.length} operator seal images`);
          
          // Ensure we have space after the images
          if (xPos !== margin) {
            yPos += imgHeight + spacing + 15;
          }
        }
      }

      // Guard Seal Tags with beautiful design
      if (sessionData.guardSealTags && sessionData.guardSealTags.length > 0) {
        yPos = Math.max(yPos, (doc as any).lastAutoTable?.finalY || 0) + 15;
        yPos = addSectionHeader('GUARD SEAL TAGS', yPos);
        
        // Add info box before table
        doc.setFillColor(...bgLightGray);
        doc.roundedRect(margin, yPos, pageWidth - margin * 2, 15, 3, 3, 'F');
        
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...grayColor);
        doc.setFontSize(9);
        doc.text(`${sessionData.guardSealTags.length} seal tags verified by guard`, margin + 10, yPos + 10);
        
        yPos += 20;

        // Prepare rows with barcode, method, status, and timestamp
        const guardSealTagRows = sessionData.guardSealTags.map(tag => [
          tag.barcode || 'N/A',
          tag.method || 'N/A',
          tag.status || 'N/A',
          tag.createdAt ? formatDate(tag.createdAt) : 'N/A'
        ]);

        // Create table with improved styling
        autoTable(doc, {
          startY: yPos,
          head: [['Barcode', 'Method', 'Status', 'Verified At']],
          body: guardSealTagRows,
          ...tableStyles,
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 45 },
            1: { cellWidth: 40 },
            2: { cellWidth: 40 },
            3: { cellWidth: 45 }
          }
        });

        // After the table, add guard seal images in a grid layout
        console.log(`Processing ${sessionData.guardSealTags.length} guard seal tags`);
        
        // Filter out tags with images
        const guardSealTagsWithImages = sessionData.guardSealTags.filter(tag => 
          tag.imageUrl || tag.imageData || (tag as any).image
        );
        
        console.log(`Found ${guardSealTagsWithImages.length} guard seal tags with potential images`);
        
        if (guardSealTagsWithImages.length > 0) {
          yPos = (doc as any).lastAutoTable.finalY + 15;
          yPos = addSectionHeader('GUARD SEAL IMAGES', yPos);
          
          // Set up image grid
          const imgWidth = 55;
          const imgHeight = 55;
          const imgsPerRow = 3;
          const spacing = 15;
          let xPos = margin;
          
          let successfulImages = 0;
          
          guardSealTagsWithImages.forEach((tag, index) => {
            try {
              // Try all possible ways to get the image
              const imageUrl = tryGetImageData(tag);
              
              if (imageUrl === undefined) {
                console.log(`No image data found for guard seal tag ${tag.barcode}`);
                return; // Skip this tag
              }
              
              // Create image card with status in subtitle
              const subtitle = tag.status 
                ? `${tag.method || ''} | ${tag.status}`
                : tag.method || '';
                
              createImageCard(
                xPos, 
                yPos, 
                imgWidth, 
                imgHeight, 
                imageUrl, 
                tag.barcode,
                subtitle
              );
              
              successfulImages++;
              
              // Move to next position
              xPos += imgWidth + spacing;
              
              // If end of row, move to next row
              if ((index + 1) % imgsPerRow === 0) {
                xPos = margin;
                yPos += imgHeight + spacing + 15;
              }
              
              // If near bottom of page, add new page
              if (yPos > doc.internal.pageSize.height - 40) {
                doc.addPage();
                yPos = 15;
                xPos = margin;
                
                yPos = addSectionHeader('GUARD SEAL IMAGES (CONTINUED)', yPos);
              }
            } catch (err) {
              console.error(`Error processing guard seal image:`, err);
            }
          });
          
          console.log(`Successfully added ${successfulImages} of ${guardSealTagsWithImages.length} guard seal images`);
          
          // Ensure we have space after the images
          if (xPos !== margin) {
            yPos += imgHeight + spacing + 15;
          }
        }
      }

      // Enhanced image page layout
      const addImagesToPdf = (imageList, title, imageLabels) => {
        if (!imageList || imageList.length === 0) return;
        
        doc.addPage();
        
        // Add elegant page header
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 20, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...white);
        doc.setFontSize(14);
        doc.text(title, pageWidth / 2, 14, { align: 'center' });
        
        // Set up layout with better dimensions
        const margin = 15;
        const imgWidth = 70;
        const imgHeight = 70;
        const spacing = 15;
        const imagesPerRow = 2; // Larger images, 2 per row
        let xPos = margin;
        let yPos = 30;
        
        let successfulImages = 0;
        
        imageList.forEach((img, index) => {
          if (!img) return;
          
          try {
            // Process image data
            const imageUrl = tryGetImageData(img);
            
            if (imageUrl === undefined) {
              console.log(`No valid image data found for image ${index} in ${title}`);
              return; // Skip this image
            }
            
            // Get label
            const label = imageLabels && imageLabels[index] 
              ? imageLabels[index] 
              : `Image ${index+1}`;
            
            // Create elegant image card
            createImageCard(
              xPos, 
              yPos, 
              imgWidth, 
              imgHeight, 
              imageUrl, 
              label
            );
            
            successfulImages++;
            
            // Update position for next image
            xPos += imgWidth + spacing;
            
            // If we're at the end of the row, go to the next row
            if ((index + 1) % imagesPerRow === 0) {
              xPos = margin;
              yPos += imgHeight + spacing + 20;
              
              // If we're at the bottom of the page, add a new page
              if (yPos + imgHeight + 20 > pageHeight - margin) {
                doc.addPage();
                
                // Add header to the new page
                doc.setFillColor(...primaryColor);
                doc.rect(0, 0, pageWidth, 20, 'F');
                
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...white);
                doc.setFontSize(14);
                doc.text(`${title} (CONTINUED)`, pageWidth / 2, 14, { align: 'center' });
                
                yPos = 30;
              }
            }
          } catch (error) {
            console.error(`Error processing image in PDF for ${title}:`, error);
          }
        });
        
        console.log(`Successfully added ${successfulImages} of ${imageList.length} images for ${title}`);
      };

      // Function to organize and add single images with proper labels
      const addSingleImagesSection = () => {
        const singleImageData = [];
        const singleImageLabels = [];
        
        // Add driver picture
        if (images.driverPicture) {
          singleImageData.push(images.driverPicture);
          singleImageLabels.push('Driver Picture');
        }
        
        // Add vehicle number plate picture
        if (images.vehicleNumberPlatePicture) {
          singleImageData.push(images.vehicleNumberPlatePicture);
          singleImageLabels.push('Vehicle Number Plate');
        }
        
        // Add GPS IMEI picture
        if (images.gpsImeiPicture) {
          singleImageData.push(images.gpsImeiPicture);
          singleImageLabels.push('GPS IMEI Picture');
        }
        
        if (singleImageData.length > 0) {
          addImagesToPdf(singleImageData, 'SESSION IMAGES', singleImageLabels);
        }
      };

      // Add single session images
      addSingleImagesSection();
      
      // Add vehicle images with labels
      if (images.vehicleImages && images.vehicleImages.length > 0) {
        const validImages = images.vehicleImages.filter(Boolean);
        const vehicleLabels = validImages.map((_, i) => `Vehicle Image ${i+1}`);
        addImagesToPdf(validImages, 'VEHICLE IMAGES', vehicleLabels);
      }
      
      // Add sealing images with labels
      if (images.sealingImages && images.sealingImages.length > 0) {
        const validImages = images.sealingImages.filter(Boolean);
        const sealingLabels = validImages.map((_, i) => `Sealing Image ${i+1}`);
        addImagesToPdf(validImages, 'SEALING IMAGES', sealingLabels);
      }
      
      // Add additional images
      if (images.additionalImages && images.additionalImages.length > 0) {
        const validImages = images.additionalImages.filter(Boolean);
        const additionalLabels = validImages.map((_, i) => `Additional Image ${i+1}`);
        addImagesToPdf(validImages, 'ADDITIONAL IMAGES', additionalLabels);
      }

      // Add beautifully styled comments section
      if (sessionData.comments && sessionData.comments.length > 0) {
        doc.addPage();
        yPos = 15;
        
        // Add styled header
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 20, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...white);
        doc.setFontSize(14);
        doc.text('SESSION COMMENTS', pageWidth / 2, 14, { align: 'center' });
        
        yPos = 30;
        
        // Add info box with comment count
        doc.setFillColor(...bgLightGray);
        doc.roundedRect(margin, yPos, pageWidth - margin * 2, 15, 3, 3, 'F');
        
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...grayColor);
        doc.setFontSize(9);
        doc.text(`${sessionData.comments.length} comments on this session`, margin + 10, yPos + 10);
        
        yPos += 25;
        
        sessionData.comments.forEach((comment, index) => {
          // Comment container with shadow and modern styling
          // Shadow
          doc.setFillColor(...lightGray);
          doc.roundedRect(margin + 3, yPos + 3, pageWidth - (margin * 2) - 3, 45, 4, 4, 'F');
          
          // Comment card
          doc.setFillColor(...white);
          doc.setDrawColor(...lightGray);
          doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 45, 4, 4, 'FD');
          
          // User info section with accent color
          doc.setFillColor(...primaryLightColor, 0.2);
          doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 15, 4, 4, 'F');
          
          // Comment header with user and timestamp
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...primaryColor);
          doc.text(`${comment.user?.name || 'Unknown User'}`, margin + 8, yPos + 10);
          
          // Role badge
          if (comment.user?.role) {
            const roleText = comment.user.role;
            const roleWidth = doc.getTextWidth(roleText) + 8;
            
            doc.setFillColor(...secondaryColor, 0.2);
            doc.roundedRect(margin + 8 + doc.getTextWidth(`${comment.user?.name || 'Unknown User'} `), yPos + 5, roleWidth, 7, 3, 3, 'F');
            
            doc.setFontSize(7);
            doc.setTextColor(...secondaryColor);
            doc.text(roleText, margin + 12 + doc.getTextWidth(`${comment.user?.name || 'Unknown User'} `), yPos + 10);
          }
          
          // Timestamp
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...grayColor);
          doc.text(formatDate(comment.createdAt), pageWidth - margin - 8, yPos + 10, { align: 'right' });
          
          // Comment content
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...darkGray);
          
          // Handle multiline comments
          const textLines = doc.splitTextToSize(comment.content || '', pageWidth - (margin * 2) - 16);
          doc.text(textLines, margin + 8, yPos + 25);
          
          // Update position for next comment
          yPos += 55;
          
          // If near bottom of page, add new page
          if (yPos > pageHeight - 70) {
            doc.addPage();
            
            // Add header to the new page
            doc.setFillColor(...primaryColor);
            doc.rect(0, 0, pageWidth, 20, 'F');
            
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...white);
            doc.setFontSize(14);
            doc.text('SESSION COMMENTS (CONTINUED)', pageWidth / 2, 14, { align: 'center' });
            
            yPos = 30;
          }
        });
      }

      // Generate PDF buffer
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      
      // Create response
      const response = new NextResponse(pdfBuffer);
      response.headers.set('Content-Type', 'application/pdf');
      response.headers.set('Content-Disposition', `attachment; filename="session-${sessionId}.pdf"`);
      response.headers.set('Content-Length', pdfBuffer.length.toString());
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      return response;
    } catch (error: unknown) {
      console.error("Error generating PDF report:", error);
      return NextResponse.json(
        { error: "Failed to generate PDF report", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY]
); 