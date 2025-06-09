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

      // Add modern styling and improved layout
      const primaryColor = [63, 81, 181]; // Material UI primary blue
      const secondaryColor = [255, 152, 0]; // Material UI orange
      const successColor = [46, 125, 50]; // Green
      const warningColor = [237, 108, 2]; // Amber
      const errorColor = [211, 47, 47]; // Red
      const grayColor = [97, 97, 97]; // Gray
      const lightGray = [224, 224, 224]; // Light gray
      const darkGray = [66, 66, 66]; // Dark gray
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;

      // Add document metadata
      doc.setProperties({
        title: `Trip Report - ${sessionData.id}`,
        subject: 'Trip Session Report',
        author: 'TripNeon System',
        keywords: 'trip, logistics, seal, verification',
        creator: 'TripNeon'
      });

      // Add footer to all pages with page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        doc.text(
          `Page ${i} of ${totalPages} | Generated on: ${new Date().toLocaleString()} | TripNeon Report System`,
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        );
      }

      // Create a more efficient header section
      let yPos = 15;

      // Company logo placeholder or company name with custom styling
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 20, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(
        sessionData.company?.name || 'Company Report',
        pageWidth / 2,
        yPos + 13,
        { align: 'center' }
      );

      // Add report title with session ID in a clean style
      yPos += 30;
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 15, 2, 2, 'F');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.setFontSize(12);
      doc.text(
        `SESSION REPORT: ${sessionData.id}`,
        pageWidth / 2,
        yPos + 10,
        { align: 'center' }
      );

      // Function for efficient section headers with modern design
      const addSectionHeader = (title: string, currentYPos: number) => {
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2], 0.1);
        doc.roundedRect(margin, currentYPos, pageWidth - margin * 2, 10, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFontSize(12);
        doc.text(title, margin + 5, currentYPos + 7);
        return currentYPos + 15;
      };

      // Function to efficiently add a simple field
      const addField = (label: string, value: string, currentXPos: number, currentYPos: number, width: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        doc.setFontSize(9);
        doc.text(label, currentXPos, currentYPos);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        doc.setFontSize(10);
        
        // Handle long text with wrapping
        const textLines = doc.splitTextToSize(value || 'N/A', width - 10);
        doc.text(textLines, currentXPos, currentYPos + 5);
        
        return currentYPos + 5 + (textLines.length * 5);
      };

      // Function to add status badge
      const addStatusBadge = (status: string, currentXPos: number, currentYPos: number) => {
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
        
        const textWidth = doc.getTextWidth(status) + 10;
        
        // Draw badge background
        doc.setFillColor(color[0], color[1], color[2], 0.2);
        doc.roundedRect(currentXPos, currentYPos - 5, textWidth, 7, 3, 3, 'F');
        
        // Draw badge text
        doc.setTextColor(color[0], color[1], color[2]);
        doc.setFontSize(8);
        doc.text(status, currentXPos + 5, currentYPos);
        
        return textWidth;
      };

      // Add key session information in a grid layout
      yPos += 20;
      const colWidth = (pageWidth - margin * 2) / 2;

      // First row - key details
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2], 0.3);
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 30, 2, 2, 'F');

      let rowYPos = yPos + 8;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.setFontSize(9);
      doc.text('Session Status:', margin + 5, rowYPos);
      const statusWidth = addStatusBadge(sessionData.status, margin + 35, rowYPos);

      doc.setFont('helvetica', 'bold');
      doc.text('Session ID:', margin + 45 + statusWidth, rowYPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(sessionId, margin + 75 + statusWidth, rowYPos);

      rowYPos += 10;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text('Created By:', margin + 5, rowYPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(sessionData.createdBy?.name || 'N/A', margin + 40, rowYPos);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text('Created At:', margin + colWidth, rowYPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(formatDate(sessionData.createdAt), margin + colWidth + 35, rowYPos);

      // Second row - source and destination
      rowYPos += 10;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text('Source:', margin + 5, rowYPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(sessionData.source || 'N/A', margin + 30, rowYPos);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text('Destination:', margin + colWidth, rowYPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(sessionData.destination || 'N/A', margin + colWidth + 40, rowYPos);

      // More space for the next section
      yPos += 40;

      // Trip Details Section with improved visual organization
      if (sessionData.tripDetails && Object.keys(sessionData.tripDetails).length > 0) {
        yPos = addSectionHeader('TRIP DETAILS', yPos);
        
        // Create a card-like container
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.roundedRect(margin, yPos, pageWidth - margin * 2, 70, 2, 2, 'FD');
        
        // Organize trip details in a grid
        const details = sessionData.tripDetails;
        const fieldWidth = (pageWidth - margin * 2 - 10) / 3;
        
        let fieldYPos = yPos + 10;
        let fieldXPos = margin + 5;
        
        // First row
        fieldYPos = addField('Transporter', details.transporterName || 'N/A', fieldXPos, fieldYPos, fieldWidth);
        fieldXPos += fieldWidth;
        fieldYPos = Math.max(fieldYPos, addField('Material', details.materialName || 'N/A', fieldXPos, fieldYPos, fieldWidth));
        fieldXPos += fieldWidth;
        fieldYPos = Math.max(fieldYPos, addField('Vehicle Number', details.vehicleNumber || 'N/A', fieldXPos, fieldYPos, fieldWidth));
        
        // Second row
        fieldYPos += 10;
        fieldXPos = margin + 5;
        fieldYPos = addField('Driver Name', details.driverName || 'N/A', fieldXPos, fieldYPos, fieldWidth);
        fieldXPos += fieldWidth;
        fieldYPos = Math.max(fieldYPos, addField('Driver Contact', details.driverContactNumber || 'N/A', fieldXPos, fieldYPos, fieldWidth));
        fieldXPos += fieldWidth;
        fieldYPos = Math.max(fieldYPos, addField('Driver License', details.driverLicense || 'N/A', fieldXPos, fieldYPos, fieldWidth));
        
        // Third row
        fieldYPos += 10;
        fieldXPos = margin + 5;
        fieldYPos = addField('Gross Weight', details.grossWeight ? `${details.grossWeight} kg` : 'N/A', fieldXPos, fieldYPos, fieldWidth);
        fieldXPos += fieldWidth;
        fieldYPos = Math.max(fieldYPos, addField('Tare Weight', details.tareWeight ? `${details.tareWeight} kg` : 'N/A', fieldXPos, fieldYPos, fieldWidth));
        fieldXPos += fieldWidth;
        fieldYPos = Math.max(fieldYPos, addField('Net Weight', details.netMaterialWeight ? `${details.netMaterialWeight} kg` : 'N/A', fieldXPos, fieldYPos, fieldWidth));
        
        yPos = fieldYPos + 10;
      }

      // Improved table styling for all tables
      const tableStyles = {
        headStyles: {
          fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10
        },
        bodyStyles: {
          fontSize: 9
        },
        alternateRowStyles: {
          fillColor: [248, 248, 248]
        },
        margin: { top: 5 },
        styles: { cellPadding: 3 }
      };

      // Function to attempt all possible ways of getting an image for the PDF
      const tryGetImageData = (imageSource: any): string | undefined => {
        try {
          // Log what we're trying to process
          console.log('Attempting to process image source:', typeof imageSource);
          
          // If it's already a string, just return it
          if (typeof imageSource === 'string' && imageSource) {
            console.log('Image source is a string:', imageSource.substring(0, 30) + '...');
            return imageSource;
          }
          
          // If it's an object with imageUrl or imageData
          if (imageSource && typeof imageSource === 'object') {
            // Try imageUrl first
            if (imageSource.imageUrl) {
              console.log('Using imageUrl:', imageSource.imageUrl.substring(0, 30) + '...');
              return imageSource.imageUrl;
            }
            
            // Try imageData next
            if (imageSource.imageData) {
              console.log('Using imageData:', imageSource.imageData.substring(0, 30) + '...');
              return imageSource.imageData;
            }
            
            // Try data property
            if (imageSource.data) {
              const contentType = imageSource.contentType || 'image/jpeg';
              console.log('Using data property with contentType:', contentType);
              return `data:${contentType};base64,${imageSource.data}`;
            }
          }
          
          console.log('No valid image data found');
          return undefined;
        } catch (err) {
          console.error('Error processing image source:', err);
          return undefined;
        }
      };

      // Operator Seal Tags with improved design
      if (sessionData.sealTags && sessionData.sealTags.length > 0) {
        yPos = Math.max(yPos, (doc as any).lastAutoTable?.finalY || 0) + 10;
        yPos = addSectionHeader('OPERATOR SEAL TAGS', yPos);

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
          theme: 'grid',
          ...tableStyles,
          columnStyles: {
            0: { cellWidth: 60 },
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
          yPos = (doc as any).lastAutoTable.finalY + 10;
          yPos = addSectionHeader('OPERATOR SEAL IMAGES', yPos);
          
          // Set up improved image grid with better spacing
          const imgWidth = 50;
          const imgHeight = 50;
          const imgsPerRow = 3;
          const spacing = 10;
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
              
              // Draw image with improved border and shadow effect
              // Shadow effect (light gray rectangle slightly offset)
              doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
              doc.roundedRect(xPos + 1, yPos + 1, imgWidth, imgHeight + 15, 2, 2, 'F');
              
              // Actual image container
              doc.setDrawColor(grayColor[0], grayColor[1], grayColor[2]);
              doc.setFillColor(255, 255, 255);
              doc.roundedRect(xPos, yPos, imgWidth, imgHeight + 15, 2, 2, 'FD');
              
              // Add image
              try {
                doc.addImage(
                  imageUrl,
                  'AUTO',
                  xPos + 2,
                  yPos + 2,
                  imgWidth - 4,
                  imgHeight - 4,
                  undefined,
                  'FAST',
                  0
                );
                successfulImages++;
                
                // Add better formatted caption with barcode
                doc.setFontSize(8);
                doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
                
                // Method badge
                if (tag.method) {
                  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2], 0.2);
                  const methodWidth = doc.getTextWidth(tag.method) + 6;
                  doc.roundedRect(
                    xPos + (imgWidth/2) - (methodWidth/2), 
                    yPos + imgHeight + 2, 
                    methodWidth, 
                    5, 
                    2, 
                    2, 
                    'F'
                  );
                  
                  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
                  doc.text(
                    tag.method,
                    xPos + imgWidth/2,
                    yPos + imgHeight + 5.5,
                    { align: 'center' }
                  );
                }
                
                // Barcode text
                doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
                doc.text(
                  tag.barcode,
                  xPos + imgWidth/2,
                  yPos + imgHeight + 11,
                  { align: 'center' }
                );
                
              } catch (imgErr) {
                console.error(`Error adding operator seal image to PDF:`, imgErr);
                // Add placeholder for failed image
                doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                doc.roundedRect(xPos + 2, yPos + 2, imgWidth - 4, imgHeight - 4, 2, 2, 'F');
                doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
                doc.setFontSize(8);
                doc.text('Image error', xPos + imgWidth/2, yPos + imgHeight/2, { align: 'center' });
              }
              
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
                yPos = margin;
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

      // Guard Seal Tags with improved design
      if (sessionData.guardSealTags && sessionData.guardSealTags.length > 0) {
        yPos = Math.max(yPos, (doc as any).lastAutoTable?.finalY || 0) + 10;
        yPos = addSectionHeader('GUARD SEAL TAGS', yPos);

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
          theme: 'grid',
          ...tableStyles,
          columnStyles: {
            0: { cellWidth: 45 },
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
          yPos = (doc as any).lastAutoTable.finalY + 10;
          yPos = addSectionHeader('GUARD SEAL IMAGES', yPos);
          
          // Set up image grid
          const imgWidth = 50;
          const imgHeight = 50;
          const imgsPerRow = 3;
          const spacing = 10;
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
              
              // Draw image with improved border and shadow effect
              // Shadow effect (light gray rectangle slightly offset)
              doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
              doc.roundedRect(xPos + 1, yPos + 1, imgWidth, imgHeight + 15, 2, 2, 'F');
              
              // Actual image container
              doc.setDrawColor(grayColor[0], grayColor[1], grayColor[2]);
              doc.setFillColor(255, 255, 255);
              doc.roundedRect(xPos, yPos, imgWidth, imgHeight + 15, 2, 2, 'FD');
              
              // Add image
              try {
                doc.addImage(
                  imageUrl,
                  'AUTO',
                  xPos + 2,
                  yPos + 2,
                  imgWidth - 4,
                  imgHeight - 4,
                  undefined,
                  'FAST',
                  0
                );
                successfulImages++;
                
                // Method badge
                if (tag.method) {
                  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2], 0.2);
                  const methodWidth = doc.getTextWidth(tag.method) + 6;
                  doc.roundedRect(
                    xPos + (imgWidth/2) - (methodWidth/2), 
                    yPos + imgHeight + 2, 
                    methodWidth, 
                    5, 
                    2, 
                    2, 
                    'F'
                  );
                  
                  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
                  doc.text(
                    tag.method,
                    xPos + imgWidth/2,
                    yPos + imgHeight + 5.5,
                    { align: 'center' }
                  );
                }
                
                // Status badge if available
                if (tag.status) {
                  let statusColor;
                  switch(tag.status) {
                    case 'BROKEN':
                    case 'TAMPERED':
                      statusColor = errorColor;
                      break;
                    case 'MISSING':
                      statusColor = warningColor;
                      break;
                    default:
                      statusColor = successColor;
                  }
                  
                  // Barcode with status
                  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
                  doc.text(
                    `${tag.barcode} (${tag.status})`,
                    xPos + imgWidth/2,
                    yPos + imgHeight + 11,
                    { align: 'center' }
                  );
                } else {
                  // Just barcode
                  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
                  doc.text(
                    tag.barcode,
                    xPos + imgWidth/2,
                    yPos + imgHeight + 11,
                    { align: 'center' }
                  );
                }
                
              } catch (imgErr) {
                console.error(`Error adding guard seal image to PDF:`, imgErr);
                // Add placeholder for failed image
                doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                doc.roundedRect(xPos + 2, yPos + 2, imgWidth - 4, imgHeight - 4, 2, 2, 'F');
                doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
                doc.setFontSize(8);
                doc.text('Image error', xPos + imgWidth/2, yPos + imgHeight/2, { align: 'center' });
              }
              
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
                yPos = margin;
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

      // Improved addImagesToPdf function for session images
      const addImagesToPdf = (imageList: string[], title: string, imageLabels?: string[]) => {
        if (!imageList || imageList.length === 0) return;
        
        doc.addPage();
        
        // Add better styled header to image page
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, pageWidth, 18, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.text(title, pageWidth / 2, 12, { align: 'center' });
        
        // Set up layout with better dimensions and organization
        const margin = 15;
        const imgWidth = 65;
        const imgHeight = 65;
        const spacing = 15;
        // Calculate images per row based on page width
        const imagesPerRow = Math.floor((pageWidth - (margin * 2) + spacing) / (imgWidth + spacing));
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
            
            // Add shadow effect
            doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
            doc.roundedRect(xPos + 2, yPos + 2, imgWidth, imgHeight + 20, 4, 4, 'F');
            
            // Create a container with border
            doc.setDrawColor(grayColor[0], grayColor[1], grayColor[2]);
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(xPos, yPos, imgWidth, imgHeight + 20, 4, 4, 'FD');
            
            // Add label above the image
            const label = imageLabels && imageLabels[index] 
              ? imageLabels[index] 
              : `Image ${index+1}`;
              
            doc.setFontSize(10);
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(label, xPos + imgWidth/2, yPos + 12, { align: 'center' });
            
            // Add image to PDF with fixed dimensions
            try {
              doc.addImage(
                imageUrl,
                'AUTO',
                xPos + 5,
                yPos + 15,
                imgWidth - 10,
                imgHeight - 10,
                undefined,
                'FAST',
                0
              );
              successfulImages++;
            } catch (imgErr) {
              console.error(`Error adding image to PDF in ${title}:`, imgErr);
              // Add placeholder for failed image
              doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
              doc.roundedRect(xPos + 5, yPos + 15, imgWidth - 10, imgHeight - 10, 2, 2, 'F');
              doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
              doc.setFontSize(8);
              doc.text('Image not available', xPos + (imgWidth/2), yPos + (imgHeight/2), { align: 'center' });
            }
            
            // Update position for next image
            xPos += imgWidth + spacing;
            
            // If we're at the end of the row, go to the next row
            if (xPos + imgWidth > pageWidth - margin) {
              xPos = margin;
              yPos += imgHeight + spacing + 20; // Space for image, shadow and caption
              
              // If we're at the bottom of the page, add a new page
              if (yPos + imgHeight + 20 > pageHeight - margin) {
                doc.addPage();
                
                // Add header to the new page
                doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                doc.rect(0, 0, pageWidth, 18, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(14);
                doc.text(`${title} (CONTINUED)`, pageWidth / 2, 12, { align: 'center' });
                
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
        const singleImageData: string[] = [];
        const singleImageLabels: string[] = [];
        
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

      // Add single session images (driver, vehicle plate, GPS)
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

      // Add comments section if available
      if (sessionData.comments && sessionData.comments.length > 0) {
        doc.addPage();
        yPos = 15;
        
        // Add styled header
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, pageWidth, 18, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.text('SESSION COMMENTS', pageWidth / 2, 12, { align: 'center' });
        
        yPos = 30;
        
        sessionData.comments.forEach((comment, index) => {
          // Comment container with shadow effect
          doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
          doc.roundedRect(margin + 2, yPos + 2, pageWidth - (margin * 2) - 2, 40, 3, 3, 'F');
          
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
          doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 40, 3, 3, 'FD');
          
          // Comment header with user and timestamp
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.text(`${comment.user?.name || 'Unknown User'} (${comment.user?.role || 'User'})`, margin + 5, yPos + 10);
          
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
          doc.text(formatDate(comment.createdAt), pageWidth - margin - 5, yPos + 10, { align: 'right' });
          
          // Comment content
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
          
          // Handle multiline comments
          const textLines = doc.splitTextToSize(comment.content || '', pageWidth - (margin * 2) - 15);
          doc.text(textLines, margin + 5, yPos + 20);
          
          // Update position for next comment
          yPos += 50;
          
          // If near bottom of page, add new page
          if (yPos > pageHeight - 60) {
            doc.addPage();
            
            // Add header to the new page
            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.rect(0, 0, pageWidth, 18, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.text('SESSION COMMENTS (CONTINUED)', pageWidth / 2, 12, { align: 'center' });
            
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