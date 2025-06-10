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

      // Simplified color scheme to match demo PDF
      const primaryColor = [0, 83, 156]; // Dark blue for headers
      const secondaryColor = [41, 128, 185]; // Medium blue for accents
      const successColor = [39, 174, 96]; // Green
      const warningColor = [243, 156, 18]; // Amber
      const errorColor = [192, 57, 43]; // Red
      const grayColor = [100, 100, 100]; // Gray for text
      const lightGray = [240, 240, 240]; // Light gray for backgrounds
      const borderColor = [200, 200, 200]; // Border color
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;

      // Add basic document metadata
      doc.setProperties({
        title: `Trip Report - ${sessionData.id}`,
        subject: 'Trip Session Report',
        author: 'TripNeon',
        creator: 'TripNeon'
      });

      // Simple header
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text('SESSION REPORT', pageWidth / 2, 16, { align: 'center' });

      let yPos = 35;

      // Session basic details
      doc.setDrawColor(...borderColor);
      doc.setFillColor(...lightGray);
      doc.rect(margin, yPos, pageWidth - (margin * 2), 40, 'FD');

      doc.setTextColor(...grayColor);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Session Details', margin + 5, yPos + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      // Move Session ID to left column and adjust position
      doc.text(`Session ID: ${sessionData.id}`, margin + 5, yPos + 20);
      doc.text(`Status: ${sessionData.status}`, margin + 5, yPos + 30);

      // Company info on the right - adjust position to avoid overlap
      doc.setFont('helvetica', 'bold');
      // Move the Company section to the right and ensure clear separation
      const companyLabelX = pageWidth - margin - 60;  // Moved further right
      doc.text('Company:', companyLabelX, yPos + 10);
      doc.setFont('helvetica', 'normal');
      doc.text(sessionData.company?.name || 'N/A', companyLabelX, yPos + 20);
      doc.text(`Created: ${formatDate(sessionData.createdAt)}`, companyLabelX, yPos + 30);

      yPos += 50;

      // Add simple section header
      const addSectionHeader = (title, currentYPos) => {
        doc.setFillColor(...primaryColor);
        doc.rect(margin, currentYPos, pageWidth - (margin * 2), 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.text(title, margin + 5, currentYPos + 5.5);
        return currentYPos + 12;
      };

      // Source and Destination
      yPos = addSectionHeader('SOURCE & DESTINATION', yPos);
      doc.setDrawColor(...borderColor);
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, yPos, pageWidth - (margin * 2), 25, 'FD');

          doc.setFont('helvetica', 'bold');
      doc.setTextColor(...grayColor);
            doc.setFontSize(10);
      doc.text('Source:', margin + 5, yPos + 10);
      doc.setFont('helvetica', 'normal');
      doc.text(sessionData.source || 'N/A', margin + 50, yPos + 10);

      doc.setFont('helvetica', 'bold');
      doc.text('Destination:', margin + 5, yPos + 20);
            doc.setFont('helvetica', 'normal');
      doc.text(sessionData.destination || 'N/A', margin + 50, yPos + 20);

      yPos += 35;

      // Trip Details section
      if (sessionData.tripDetails && Object.keys(sessionData.tripDetails).length > 0) {
        yPos = addSectionHeader('TRIP DETAILS', yPos);
        
        // Format trip details as a table
        const tripDetails = sessionData.tripDetails;
        const detailsArray = [];
        
        // Add key trip details to the array
        if (tripDetails.transporterName) detailsArray.push(['Transporter', tripDetails.transporterName]);
        if (tripDetails.materialName) detailsArray.push(['Material', tripDetails.materialName]);
        if (tripDetails.vehicleNumber) detailsArray.push(['Vehicle Number', tripDetails.vehicleNumber]);
        if (tripDetails.driverName) detailsArray.push(['Driver Name', tripDetails.driverName]);
        if (tripDetails.driverContactNumber) detailsArray.push(['Driver Contact', tripDetails.driverContactNumber]);
        if (tripDetails.driverLicense) detailsArray.push(['Driver License', tripDetails.driverLicense]);
        if (tripDetails.grossWeight) detailsArray.push(['Gross Weight', `${tripDetails.grossWeight} kg`]);
        if (tripDetails.tareWeight) detailsArray.push(['Tare Weight', `${tripDetails.tareWeight} kg`]);
        if (tripDetails.netMaterialWeight) detailsArray.push(['Net Weight', `${tripDetails.netMaterialWeight} kg`]);
        
        // Create table
      autoTable(doc, {
          startY: yPos,
        head: [],
          body: detailsArray,
          theme: 'striped',
          styles: { fontSize: 10 },
          columnStyles: {
            0: { cellWidth: 60, fontStyle: 'bold' },
            1: { cellWidth: 100 }
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          tableWidth: 'auto',
          margin: { left: margin }
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Enhanced image processing function to handle different image formats
      const tryGetImageData = (imageSource: any): string | undefined => {
        try {
          console.log('Processing image source:', typeof imageSource);
          
          // If it's already a string, just return it
          if (typeof imageSource === 'string' && imageSource) {
            console.log('Using string image source');
            return imageSource;
          }
          
          // If it's an object with imageUrl or imageData
          if (imageSource && typeof imageSource === 'object') {
            // Try imageUrl first
            if (imageSource.imageUrl) {
              console.log('Using imageUrl');
              return imageSource.imageUrl;
            }
            
            // Try imageData next
            if (imageSource.imageData) {
              console.log('Using imageData');
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

      // Operator Seal Tags Section
      if (sessionData.sealTags && sessionData.sealTags.length > 0) {
        yPos = Math.max(yPos, (doc as any).lastAutoTable?.finalY || 0) + 10;
        yPos = addSectionHeader('OPERATOR SEAL TAGS', yPos);

        // Create table for operator seal tags
        const sealTagRows = sessionData.sealTags.map(tag => [
          tag.barcode || 'N/A',
          tag.method || 'N/A',
          tag.createdAt ? formatDate(tag.createdAt) : 'N/A'
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Barcode', 'Method', 'Applied At']],
          body: sealTagRows,
        theme: 'grid',
        styles: { fontSize: 10 },
        columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 60 },
            2: { cellWidth: 60 }
          },
          headStyles: {
            fillColor: primaryColor
        }
      });

        // After the table, add operator seal images in a grid layout
        console.log(`Processing ${sessionData.sealTags.length} operator seal tags`);
        
        // Get all tags with images
        const sealTagsWithImages = sessionData.sealTags.filter(tag => 
          tag.imageUrl || tag.imageData || (tag as any).image
        );
        
        console.log(`Found ${sealTagsWithImages.length} operator seal tags with potential images`);
        
        if (sealTagsWithImages.length > 0) {
          yPos = (doc as any).lastAutoTable.finalY + 10;
          
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...primaryColor);
          doc.setFontSize(11);
          doc.text('Operator Seal Images:', margin, yPos);
          yPos += 8;
          
          // Update image grid with 200x200 dimensions
          const imgWidth = 200;
          const imgHeight = 200;
          const imgsPerRow = 1; // One large image per row for better visibility
          const spacing = 20;
          let xPos = margin;
          
          let successfulImages = 0;
          
          sealTagsWithImages.forEach((tag, index) => {
            try {
              // Get image data
              const imageUrl = tryGetImageData(tag);
              
              if (imageUrl === undefined) {
                console.log(`No image data found for operator seal tag ${tag.barcode}`);
                return; // Skip this tag
              }
              
              // Draw container
              doc.setDrawColor(...borderColor);
              doc.setFillColor(255, 255, 255);
              doc.rect(xPos, yPos, imgWidth, imgHeight + 15, 'FD');
              
              // Add image
              try {
                doc.addImage(
                  imageUrl,
                  'AUTO',
                  xPos + 5,
                  yPos + 5,
                  imgWidth - 10,
                  imgHeight - 10,
                  undefined,
                  'FAST',
                  0
                );
                successfulImages++;
                
                // Add caption with barcode
                doc.setFontSize(10);
                doc.setTextColor(...grayColor);
                doc.text(
                  `Seal: ${tag.barcode} (${tag.method || 'N/A'})`,
                  xPos + imgWidth/2,
                  yPos + imgHeight + 10,
                  { align: 'center' }
                );
              } catch (imgErr) {
                console.error(`Error adding operator seal image to PDF:`, imgErr);
                // Add placeholder for failed image
                doc.setFillColor(...lightGray);
                doc.rect(xPos + 5, yPos + 5, imgWidth - 10, imgHeight - 10, 'F');
                doc.setTextColor(...grayColor);
      doc.setFontSize(10);
                doc.text('Image not available', xPos + imgWidth/2, yPos + imgHeight/2, { align: 'center' });
                
                // Still add the caption
                doc.text(
                  `Seal: ${tag.barcode} (${tag.method || 'N/A'})`,
                  xPos + imgWidth/2,
                  yPos + imgHeight + 10,
                  { align: 'center' }
                );
              }
              
              // Move to next position - always to next row since we're using 1 image per row
              xPos = margin;
              yPos += imgHeight + spacing + 15;
              
              // If near bottom of page, add new page
              if (yPos > doc.internal.pageSize.height - 40) {
                doc.addPage();
                yPos = margin;
                xPos = margin;
                
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...primaryColor);
                doc.setFontSize(11);
                doc.text('Operator Seal Images (continued):', margin, yPos);
                yPos += 8;
              }
            } catch (err) {
              console.error(`Error processing operator seal image:`, err);
            }
          });
          
          console.log(`Successfully added ${successfulImages} of ${sealTagsWithImages.length} operator seal images`);
        }
      }

      // Guard Seal Tags Section
      if (sessionData.guardSealTags && sessionData.guardSealTags.length > 0) {
        yPos = Math.max(yPos, (doc as any).lastAutoTable?.finalY || 0) + 10;
        yPos = addSectionHeader('GUARD SEAL TAGS', yPos);

        // Create table for guard seal tags
        const guardSealTagRows = sessionData.guardSealTags.map(tag => [
          tag.barcode || 'N/A',
          tag.method || 'N/A',
          tag.status || 'N/A',
          tag.createdAt ? formatDate(tag.createdAt) : 'N/A'
        ]);

      autoTable(doc, {
          startY: yPos,
          head: [['Barcode', 'Method', 'Status', 'Verified At']],
          body: guardSealTagRows,
            theme: 'grid',
        styles: { fontSize: 10 },
            columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 40 },
            2: { cellWidth: 40 },
            3: { cellWidth: 50 }
          },
          headStyles: {
            fillColor: primaryColor
        }
      });

        // After the table, add guard seal images in a grid layout
        console.log(`Processing ${sessionData.guardSealTags.length} guard seal tags`);
        
        // Get all tags with images
        const guardSealTagsWithImages = sessionData.guardSealTags.filter(tag => 
          tag.imageUrl || tag.imageData || (tag as any).image
        );
        
        console.log(`Found ${guardSealTagsWithImages.length} guard seal tags with potential images`);
        
        if (guardSealTagsWithImages.length > 0) {
          yPos = (doc as any).lastAutoTable.finalY + 10;
          
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...primaryColor);
          doc.setFontSize(11);
          doc.text('Guard Seal Images:', margin, yPos);
          yPos += 8;
          
          // Update image grid with 200x200 dimensions
          const imgWidth = 200;
          const imgHeight = 200;
          const imgsPerRow = 1; // One large image per row for better visibility
          const spacing = 20;
          let xPos = margin;
          
          let successfulImages = 0;
          
          guardSealTagsWithImages.forEach((tag, index) => {
            try {
              // Get image data
              const imageUrl = tryGetImageData(tag);
              
              if (imageUrl === undefined) {
                console.log(`No image data found for guard seal tag ${tag.barcode}`);
                return; // Skip this tag
              }
              
              // Draw container
              doc.setDrawColor(...borderColor);
              doc.setFillColor(255, 255, 255);
              doc.rect(xPos, yPos, imgWidth, imgHeight + 15, 'FD');
              
              // Add image
              try {
                doc.addImage(
                  imageUrl,
                  'AUTO',
                  xPos + 5,
                  yPos + 5,
                  imgWidth - 10,
                  imgHeight - 10,
                  undefined,
                  'FAST',
                  0
                );
                successfulImages++;
                
                // Add caption with barcode and status
                doc.setFontSize(10);
                doc.setTextColor(...grayColor);
                doc.text(
                  `Seal: ${tag.barcode} (${tag.method || 'N/A'})`,
                  xPos + imgWidth/2,
                  yPos + imgHeight + 5,
                  { align: 'center' }
                );
                
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
                  
                  doc.setTextColor(...statusColor);
                  doc.text(
                    `Status: ${tag.status}`,
                    xPos + imgWidth/2,
                    yPos + imgHeight + 12,
                    { align: 'center' }
                  );
                }
              } catch (imgErr) {
                console.error(`Error adding guard seal image to PDF:`, imgErr);
                // Add placeholder for failed image
                doc.setFillColor(...lightGray);
                doc.rect(xPos + 5, yPos + 5, imgWidth - 10, imgHeight - 10, 'F');
                doc.setTextColor(...grayColor);
      doc.setFontSize(10);
                doc.text('Image not available', xPos + imgWidth/2, yPos + imgHeight/2, { align: 'center' });
                
                // Still add the caption
                doc.text(
                  `Seal: ${tag.barcode} (${tag.method || 'N/A'})`,
                  xPos + imgWidth/2,
                  yPos + imgHeight + 5,
                  { align: 'center' }
                );
                
                if (tag.status) {
                  doc.text(
                    `Status: ${tag.status}`,
                    xPos + imgWidth/2,
                    yPos + imgHeight + 12,
                    { align: 'center' }
                  );
                }
              }
              
              // Move to next position - always to next row since we're using 1 image per row
              xPos = margin;
              yPos += imgHeight + spacing + 15;
              
              // If near bottom of page, add new page
              if (yPos > doc.internal.pageSize.height - 40) {
                doc.addPage();
                yPos = margin;
                xPos = margin;
                
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...primaryColor);
                doc.setFontSize(11);
                doc.text('Guard Seal Images (continued):', margin, yPos);
                yPos += 8;
              }
            } catch (err) {
              console.error(`Error processing guard seal image:`, err);
            }
          });
          
          console.log(`Successfully added ${successfulImages} of ${guardSealTagsWithImages.length} guard seal images`);
        }
      }

      // Session Images section
      // Helper function to add images to PDF
      const addImagesToPdf = (imageList, title, imageLabels) => {
        if (!imageList || imageList.length === 0) return;
        
        doc.addPage();
        
        // Add header
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 15, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text(title, pageWidth / 2, 10, { align: 'center' });
        
        // Set up image grid layout with 200x200 dimensions
        const margin = 20;
        const imgWidth = 200;  // Set to 200 as requested
        const imgHeight = 200; // Set to 200 as requested
        const spacing = 20;
        const imgsPerRow = 1;  // One image per row for better visibility
        let xPos = margin;
        let yPos = 25;
        
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
            
            // Create container
            doc.setDrawColor(...borderColor);
            doc.setFillColor(255, 255, 255);
            doc.rect(xPos, yPos, imgWidth, imgHeight + 20, 'FD');
            
            // Add label as a header above the image
            const label = imageLabels && imageLabels[index] 
              ? imageLabels[index] 
              : `Image ${index+1}`;
            
            doc.setFontSize(11);
            doc.setTextColor(...primaryColor);
            doc.setFont('helvetica', 'bold');
            doc.text(label, xPos + 5, yPos + 12);
            
            // Add image
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
              console.error(`Error adding image to PDF for ${title}:`, imgErr);
              // Add placeholder for failed image
              doc.setFillColor(...lightGray);
              doc.rect(xPos + 5, yPos + 15, imgWidth - 10, imgHeight - 10, 'F');
              doc.setTextColor(...grayColor);
              doc.setFontSize(10);
              doc.text('Image not available', xPos + imgWidth/2, yPos + imgHeight/2, { align: 'center' });
            }
            
            // Always move to next row since we're displaying one image per row
            xPos = margin;
                          yPos += imgHeight + spacing + 15;
              
              // If near bottom of page, add a new page
              if (yPos + imgHeight + 20 > doc.internal.pageSize.height - margin) {
                doc.addPage();
                
                // Add header to the new page
                doc.setFillColor(...primaryColor);
                doc.rect(0, 0, pageWidth, 15, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(12);
                doc.text(`${title} (continued)`, pageWidth / 2, 10, { align: 'center' });
                
                yPos = 25;
              }
            } catch (error) {
            console.error(`Error processing image in PDF for ${title}:`, error);
          }
        });
        
        console.log(`Successfully added ${successfulImages} of ${imageList.length} images for ${title}`);
      };

      // Add vehicle images
      if (images.vehicleImages && images.vehicleImages.length > 0) {
        const validImages = images.vehicleImages.filter(Boolean);
        const vehicleLabels = validImages.map((_, i) => `Vehicle Image ${i+1}`);
        addImagesToPdf(validImages, 'VEHICLE IMAGES', vehicleLabels);
      }

      // Add driver and vehicle plate images
      if (images.driverPicture || images.vehicleNumberPlatePicture || images.gpsImeiPicture) {
        const keyImages = [];
        const keyLabels = [];
        
        if (images.driverPicture) {
          keyImages.push(images.driverPicture);
          keyLabels.push('Driver Picture');
        }
        
        if (images.vehicleNumberPlatePicture) {
          keyImages.push(images.vehicleNumberPlatePicture);
          keyLabels.push('Vehicle Number Plate');
        }
        
        if (images.gpsImeiPicture) {
          keyImages.push(images.gpsImeiPicture);
          keyLabels.push('GPS IMEI Picture');
        }
        
        if (keyImages.length > 0) {
          addImagesToPdf(keyImages, 'KEY IMAGES', keyLabels);
        }
      }

      // Add sealing images
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

      // Add footer with page numbers
      const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
        doc.setFillColor(...lightGray);
        doc.rect(0, doc.internal.pageSize.height - 15, pageWidth, 15, 'F');
          doc.setFontSize(8);
        doc.setTextColor(...grayColor);
          doc.text(
          `Page ${i} of ${pageCount} | Generated on ${new Date().toLocaleString()}`,
          pageWidth / 2,
          doc.internal.pageSize.height - 6,
            { align: 'center' }
          );
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