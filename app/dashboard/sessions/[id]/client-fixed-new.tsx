          <CommentSection sessionId={sessionId} />

          {/* Loading Details Section - Added as per requirements */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Loading Details</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              {session.tripDetails && (
                <>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Transporter Name:</Typography>
                    <Typography variant="body1">{session.tripDetails.transporterName || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Material Name:</Typography>
                    <Typography variant="body1">{session.tripDetails.materialName || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">GPS IMEI Number:</Typography>
                    <Typography variant="body1">{session.tripDetails.gpsImeiNumber || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Loader Name:</Typography>
                    <Typography variant="body1">{session.tripDetails.loaderName || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Loader Mobile Number:</Typography>
                    <Typography variant="body1">{session.tripDetails.loaderMobileNumber || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Loading Site:</Typography>
                    <Typography variant="body1">{session.tripDetails.loadingSite || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Challan/Royalty Number:</Typography>
                    <Typography variant="body1">{session.tripDetails.challanRoyaltyNumber || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">DO Number:</Typography>
                    <Typography variant="body1">{session.tripDetails.doNumber || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">TP Number:</Typography>
                    <Typography variant="body1">{session.tripDetails.tpNumber || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Freight:</Typography>
                    <Typography variant="body1">{session.tripDetails.freight || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Quality of Materials:</Typography>
                    <Typography variant="body1">{session.tripDetails.qualityOfMaterials || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Gross Weight:</Typography>
                    <Typography variant="body1">{session.tripDetails.grossWeight || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Tare Weight:</Typography>
                    <Typography variant="body1">{session.tripDetails.tareWeight || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Net Material Weight:</Typography>
                    <Typography variant="body1">{session.tripDetails.netMaterialWeight || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Receiver Party Name:</Typography>
                    <Typography variant="body1">{session.tripDetails.receiverPartyName || 'N/A'}</Typography>
                  </Grid>
                </>
              )}
            </Grid>
            {!session.tripDetails && (
              <Alert severity="info">No loading details available</Alert>
            )}
          </Paper>

          {/* Operator Seal Tag Table Section */} 