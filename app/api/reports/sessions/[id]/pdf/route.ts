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
          // Fetch seal tags and guard seal tags
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

      // Document settings - Simplified color scheme with just 2-3 colors
      const primaryColor = [0, 83, 156]; // Changed from blue to dark blue (no red component)
      const grayColor = [100, 100, 100]; // Gray for text - secondary color
      const lightGray = [240, 240, 240]; // Light gray for backgrounds - tertiary color
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;

      // Add header with logo-like styling
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text('SESSION REPORT', pageWidth / 2, 15, { align: 'center' });

      // Add session basic info box
      doc.setDrawColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.roundedRect(margin, 30, pageWidth - (margin * 2), 40, 3, 3, 'FD');
      
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.setFontSize(14);
      doc.text('Session Details', margin + 5, 40);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Session ID: ${sessionData.id}`, margin + 5, 50);
      doc.text(`Status: ${sessionData.status.replace(/_/g, ' ')}`, margin + 5, 58);
      doc.text(`Date: ${formatDate(sessionData.createdAt)}`, margin + 5, 66);
      
      // Add company info on the right side
      doc.setFont('helvetica', 'bold');
      doc.text('Company Information', pageWidth - margin - 70, 40);
      doc.setFont('helvetica', 'normal');
      doc.text(`${sessionData.company.name || 'N/A'}`, pageWidth - margin - 70, 50);
      doc.text(`Source: ${sessionData.source || 'N/A'}`, pageWidth - margin - 70, 58);
      doc.text(`Destination: ${sessionData.destination || 'N/A'}`, pageWidth - margin - 70, 66);

      // Section styling function
      const addSectionHeader = (title: string, y: number) => {
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2], 0.1);
        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFontSize(12);
        doc.text(title, margin + 3, y + 5.5);
        return y + 15;
      };

      // Trip Details section
      let yPos = 80;
      yPos = addSectionHeader('TRIP DETAILS', yPos);

      // Format trip details in a more structured way
      const tripDetailsRows = [
        ['Freight', tripDetails.freight != null ? String(tripDetails.freight) : 'N/A'],
        ['Do Number', tripDetails.doNumber ?? 'N/A'],
        ['Tp Number', tripDetails.tpNumber ?? 'N/A'],
        ['Driver Name', tripDetails.driverName ?? 'N/A'],
        ['Loader Name', tripDetails.loaderName ?? 'N/A'],
        ['Tare Weight', tripDetails.tareWeight != null ? String(tripDetails.tareWeight) : 'N/A'],
        ['Gross Weight', tripDetails.grossWeight != null ? String(tripDetails.grossWeight) : 'N/A'],
        ['Material Name', tripDetails.materialName ?? 'N/A'],
        ['Gps Imei Number', tripDetails.gpsImeiNumber ?? 'N/A'],
        ['Vehicle Number', tripDetails.vehicleNumber ?? 'N/A'],
        ['Transporter Name', tripDetails.transporterName ?? 'N/A'],
        ['Receiver Party Name', tripDetails.receiverPartyName ?? 'N/A'],
        ['Loader Mobile Number', tripDetails.loaderMobileNumber ?? 'N/A'],
        ['Quality Of Materials', tripDetails.qualityOfMaterials ?? 'N/A'],
        ['Driver Contact Number', tripDetails.driverContactNumber ?? 'N/A'],
        ['Challan Royalty Number', tripDetails.challanRoyaltyNumber ?? 'N/A'],
        ['Driver License', tripDetails.driverLicense ?? 'N/A'],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [],
        body: tripDetailsRows,
        theme: 'striped',
        styles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 60, fontStyle: 'bold' },
          1: { cellWidth: 110 }
        },
        headStyles: {
          fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]]
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      });

      // Operator Seal Tags
      if (sessionData.sealTags && sessionData.sealTags.length > 0) {
        yPos = (doc as any).lastAutoTable.finalY + 10;
        yPos = addSectionHeader('OPERATOR SEAL TAGS', yPos);

        // Calculate image size that works well in the table
        const sealImageSize = 20; // Size in mm for seal images in table
        
        // Prepare rows with barcode, method, image, and timestamp
        const sealTagRows = [];
        
        // Process each seal tag
        for (const tag of sessionData.sealTags) {
          // Base row data
          const rowData = [
            tag.barcode || 'N/A',
            tag.method || 'N/A',
            tag.createdAt ? formatDate(tag.createdAt) : 'N/A'
          ];
          
          // Store if this tag has an image for adding after table creation
          if (tag.imageData || tag.imageUrl) {
            (tag as any)._hasImage = true;
          } else {
            (tag as any)._hasImage = false;
          }
          
          sealTagRows.push(rowData);
        }

        // Create table
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
            fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]]
          },
          didDrawCell: function(data) {
            // Don't add images to header cells
            if (data.row.index === 0) return;
            
            // Get the tag for this row
            const tag = sessionData.sealTags![data.row.index - 1];
            
            // Only add image if tag has one and we're in a new cell where image should be shown
            if ((tag as any)._hasImage && data.column.index === 1) {
              try {
                const imageUrl = (tag.imageData || tag.imageUrl || '') as string;
                const cellHeight = data.cell.height - 2;
                const cellWidth = data.cell.width - 2;
                const imgSize = Math.min(cellHeight, cellWidth);
                
                // Add image in the cell next to method
                doc.addImage(
                  imageUrl,
                  'AUTO',
                  data.cell.x + data.cell.width + 2,
                  data.cell.y + 1,
                  imgSize - 2,
                  imgSize - 2,
                  undefined,
                  'FAST',
                  0
                );
              } catch (err) {
                console.error(`Error adding seal tag image in table:`, err);
              }
            }
          }
        });
      }

      // Guard Seal Tags
      if (sessionData.guardSealTags && sessionData.guardSealTags.length > 0) {
        yPos = (doc as any).lastAutoTable.finalY + 10;
        yPos = addSectionHeader('GUARD SEAL TAGS', yPos);

        // Calculate image size that works well in the table
        const sealImageSize = 20; // Size in mm for seal images in table
        
        // Prepare rows with barcode, method, status, and timestamp
        const guardSealTagRows = [];
        
        // Process each seal tag
        for (const tag of sessionData.guardSealTags) {
          // Base row data
          const rowData = [
            tag.barcode || 'N/A',
            tag.method || 'N/A',
            tag.status || 'N/A',
            tag.createdAt ? formatDate(tag.createdAt) : 'N/A'
          ];
          
          // Store if this tag has an image for adding after table creation
          if (tag.imageData || tag.imageUrl) {
            (tag as any)._hasImage = true;
          } else {
            (tag as any)._hasImage = false;
          }
          
          guardSealTagRows.push(rowData);
        }

        // Create table
        autoTable(doc, {
          startY: yPos,
          head: [['Barcode', 'Method', 'Status', 'Verified At']],
          body: guardSealTagRows,
          theme: 'grid',
          styles: { fontSize: 10 },
          columnStyles: {
            0: { cellWidth: 45 },
            1: { cellWidth: 40 },
            2: { cellWidth: 40 },
            3: { cellWidth: 45 }
          },
          headStyles: {
            fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]]
          },
          didDrawCell: function(data) {
            // Don't add images to header cells
            if (data.row.index === 0) return;
            
            // Get the tag for this row
            const tag = sessionData.guardSealTags![data.row.index - 1];
            
            // Only add image if tag has one and we're in a new cell where image should be shown
            if ((tag as any)._hasImage && data.column.index === 2) {
              try {
                const imageUrl = (tag.imageData || tag.imageUrl || '') as string;
                const cellHeight = data.cell.height - 2;
                const cellWidth = data.cell.width - 2;
                const imgSize = Math.min(cellHeight, cellWidth);
                
                // Add image in the cell next to status
                doc.addImage(
                  imageUrl,
                  'AUTO',
                  data.cell.x + data.cell.width + 2,
                  data.cell.y + 1,
                  imgSize - 2,
                  imgSize - 2,
                  undefined,
                  'FAST',
                  0
                );
              } catch (err) {
                console.error(`Error adding guard seal tag image in table:`, err);
              }
            }
          }
        });
      }

      // Add Images
      // Helper function to add images to PDF with fixed dimensions
      const addImagesToPdf = (imageList: string[], title: string, imageLabels?: string[]) => {
        if (!imageList || imageList.length === 0) return;
        
        doc.addPage();
        
        // Add header to image page - using primary color
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, pageWidth, 15, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text(title, pageWidth / 2, 10, { align: 'center' });
        
        // Set up layout with fixed dimensions
        const margin = 15;
        const imgWidth = 200 / 2.83; // Convert 200px to mm (1px ≈ 0.35mm but using 2.83 for better sizing)
        const imgHeight = 200 / 2.83; // Fixed 200px height
        const spacing = 10;
        // Calculate images per row based on page width and image width
        const imagesPerRow = Math.floor((pageWidth - (margin * 2)) / (imgWidth + spacing));
        let xPos = margin;
        let yPos = 25;
        
        imageList.forEach((img, index) => {
          if (!img) return;
          
          try {
            // Create a simple border - using gray color
            doc.setDrawColor(grayColor[0], grayColor[1], grayColor[2]);
            doc.setFillColor(255, 255, 255); // White background for image container
            doc.rect(xPos, yPos, imgWidth, imgHeight + 20, 'FD');
            
            // Add label as a header above the image
            const label = imageLabels && imageLabels[index] 
              ? imageLabels[index] 
              : `Image ${index+1}`;
              
            doc.setFontSize(10);
            doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(label, xPos + 5, yPos + 12);
            
            // Add image to PDF with fixed dimensions
            try {
              doc.addImage(
                img, 
                'AUTO', 
                xPos + 5, 
                yPos + 15, 
                imgWidth - 10, 
                imgHeight - 15, 
                undefined, 
                'FAST', 
                0
              );
            } catch (err) {
              console.error(`Error adding image ${index}:`, err);
              // Add placeholder for failed image - using light gray
              doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
              doc.rect(xPos + 5, yPos + 15, imgWidth - 10, imgHeight - 15, 'F');
              doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
              doc.setFontSize(8);
              doc.text('Image not available', xPos + (imgWidth/2), yPos + (imgHeight/2), { align: 'center' });
            }
            
            // Update position for next image
            xPos += imgWidth + spacing;
            
            // If we're at the end of the row, go to the next row
            if (xPos + imgWidth > doc.internal.pageSize.width - margin) {
              xPos = margin;
              yPos += imgHeight + spacing + 15; // Space for image and caption
              
              // If we're at the bottom of the page, add a new page
              if (yPos + imgHeight + 15 > doc.internal.pageSize.height - margin) {
                doc.addPage();
                
                // Add header to the new page
                doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                doc.rect(0, 0, pageWidth, 15, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(12);
                doc.text(`${title} (continued)`, pageWidth / 2, 10, { align: 'center' });
                
                yPos = 25;
              }
            }
          } catch (error) {
            console.error(`Error processing image in PDF:`, error);
          }
        });
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
      
      // Add footer with page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.rect(0, doc.internal.pageSize.height - 15, pageWidth, 15, 'F');
        doc.setFontSize(8);
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        doc.text(
          `Page ${i} of ${pageCount} | Generated on ${new Date().toLocaleString()}`,
          doc.internal.pageSize.width / 2,
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