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

      // Document settings
      const primaryColor = [0, 123, 255]; // Blue color
      const secondaryColor = [108, 117, 125]; // Gray color
      const successColor = [40, 167, 69]; // Green color
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
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, 30, pageWidth - (margin * 2), 40, 3, 3, 'FD');
      
      doc.setTextColor(0, 0, 0);
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

        const sealTagRows = sessionData.sealTags.map(tag => [
          tag.barcode,
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
            fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]]
          }
        });
      }

      // Guard Seal Tags
      if (sessionData.guardSealTags && sessionData.guardSealTags.length > 0) {
        yPos = (doc as any).lastAutoTable.finalY + 10;
        yPos = addSectionHeader('GUARD SEAL TAGS', yPos);

        const guardSealTagRows = sessionData.guardSealTags.map(tag => [
          tag.barcode,
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
            0: { cellWidth: 45 },
            1: { cellWidth: 40 },
            2: { cellWidth: 40 },
            3: { cellWidth: 45 }
          },
          headStyles: {
            fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]]
          }
        });
      }

      // Add Images
      // Helper function to add images to PDF with better layout
      const addImagesToPdf = (imageList: string[], title: string) => {
        if (!imageList || imageList.length === 0) return;
        
        doc.addPage();
        
        // Add header to image page
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, pageWidth, 15, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text(title, pageWidth / 2, 10, { align: 'center' });
        
        const margin = 15;
        const imgWidth = 80;
        const imgHeight = 80;
        const spacing = 10;
        let xPos = margin;
        let yPos = 25;
        
        imageList.forEach((img, index) => {
          if (!img) return;
          
          try {
            // Add image frame
            doc.setDrawColor(220, 220, 220);
            doc.setFillColor(252, 252, 252);
            doc.roundedRect(xPos - 2, yPos - 2, imgWidth + 4, imgHeight + 14, 2, 2, 'FD');
            
            // Add image to PDF
            doc.addImage(img, 'AUTO', xPos, yPos, imgWidth, imgHeight);
            
            // Add caption
            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);
            doc.setFont('helvetica', 'bold');
            doc.text(`Image ${index+1}`, xPos + imgWidth/2, yPos + imgHeight + 7, { align: 'center' });
            
            // Update position for next image
            xPos += imgWidth + spacing + 5;
            
            // If we're at the end of the row, go to the next row
            if (xPos + imgWidth > doc.internal.pageSize.width - margin) {
              xPos = margin;
              yPos += imgHeight + spacing + 15; // 15 extra for caption and frame
              
              // If we're at the bottom of the page, add a new page
              if (yPos + imgHeight > doc.internal.pageSize.height - margin) {
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
            console.error(`Error adding image to PDF:`, error);
          }
        });
      };

      // Add seal tag images
      let sealTagImages: string[] = [];
      if (sessionData.sealTags) {
        sealTagImages = sessionData.sealTags
          .filter(tag => tag.imageData || tag.imageUrl)
          .map(tag => (tag.imageData || tag.imageUrl || '') as string);
      }
      
      if (sealTagImages.length > 0) {
        addImagesToPdf(sealTagImages, 'OPERATOR SEAL TAG IMAGES');
      }
      
      // Add guard seal tag images
      let guardSealTagImages: string[] = [];
      if (sessionData.guardSealTags) {
        guardSealTagImages = sessionData.guardSealTags
          .filter(tag => tag.imageData || tag.imageUrl)
          .map(tag => (tag.imageData || tag.imageUrl || '') as string);
      }
      
      if (guardSealTagImages.length > 0) {
        addImagesToPdf(guardSealTagImages, 'GUARD SEAL TAG IMAGES');
      }

      // Add other session images
      if (images.driverPicture || images.vehicleNumberPlatePicture || images.gpsImeiPicture) {
        const singleImages = [
          images.driverPicture,
          images.vehicleNumberPlatePicture,
          images.gpsImeiPicture
        ].filter(Boolean) as string[];
        
        addImagesToPdf(singleImages, 'SESSION IMAGES');
      }
      
      // Add vehicle images
      if (images.vehicleImages && images.vehicleImages.length > 0) {
        addImagesToPdf(images.vehicleImages.filter(Boolean), 'VEHICLE IMAGES');
      }
      
      // Add additional images
      if (images.additionalImages && images.additionalImages.length > 0) {
        addImagesToPdf(images.additionalImages.filter(Boolean), 'ADDITIONAL IMAGES');
      }
      
      // Add footer with page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(245, 245, 245);
        doc.rect(0, doc.internal.pageSize.height - 15, pageWidth, 15, 'F');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
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