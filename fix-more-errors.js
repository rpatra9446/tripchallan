const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the issues specific to line 1375 mentioned in the build error
const renderTripDetailsVerificationFix = `  const renderTripDetailsVerification = () => {
    if (!session || !session.tripDetails) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No trip details available for verification.
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Loading Details Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please verify the loading details by comparing physical documents and vehicle information.
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'background.paper' }}>
                <TableCell width="40%"><strong>Field</strong></TableCell>
                <TableCell width="45%"><strong>Operator Value</strong></TableCell>
                <TableCell width="15%"><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(verificationFields)
                .filter(([field, _]) => [
                  'transporterName', 'materialName', 'receiverPartyName', 'vehicleNumber',
                  'registrationCertificate', 'gpsImeiNumber', 'cargoType', 'loadingSite',
                  'loaderName', 'challanRoyaltyNumber', 'doNumber', 'freight',
                  'qualityOfMaterials', 'numberOfPackages', 'tpNumber', 'grossWeight',
                  'tareWeight', 'netMaterialWeight', 'loaderMobileNumber',
                  'source', 'destination' // Added source and destination fields
                ].includes(field))
                .map(([field, data]) => (
                <TableRow key={field} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell component="th" scope="row">
                    {getFieldLabel(field)}
                  </TableCell>
                  <TableCell>
                    {data.operatorValue}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" flexDirection="column" alignItems="center">
                      <IconButton 
                        onClick={() => verifyField(field)}
                        color={data.isVerified ? "success" : "default"}
                        size="small"
                      >
                        {data.isVerified ? <CheckCircle /> : <RadioButtonUnchecked />}
                      </IconButton>
                      <TextField 
                        size="small"
                        placeholder="Add comment"
                        value={data.comment}
                        onChange={(e) => handleCommentChange(field, e.target.value)}
                        variant="standard"
                        sx={{ mt: 1, width: '100%' }}
                        InputProps={{
                          endAdornment: data.comment ? (
                            <InputAdornment position="end">
                              <IconButton 
                                onClick={() => handleCommentChange(field, '')}
                                edge="end"
                                size="small" 
                              >
                                <Close fontSize="small" />
                              </IconButton>
                            </InputAdornment>
                          ) : null,
                        }}
                      />
                    </Box>
                  </TableCell>
                </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };`;

// Replace the entire function with the fixed version
const renderTripDetailsVerificationRegex = /const renderTripDetailsVerification = \(\) => \{[\s\S]*?\};/;
content = content.replace(renderTripDetailsVerificationRegex, renderTripDetailsVerificationFix);

// Fix the driver details verification function
const renderDriverDetailsVerificationFix = `  // Driver Details Verification
  const renderDriverDetailsVerification = () => {
    if (!session || !session.tripDetails) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No driver details available for verification.
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Driver Details Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please verify the driver's details and documents. Cross-check with physical license and identification.
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'background.paper' }}>
                <TableCell width="40%"><strong>Field</strong></TableCell>
                <TableCell width="45%"><strong>Operator Value</strong></TableCell>
                <TableCell width="15%"><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(verificationFields)
                .filter(([field, _]) => [
                  'driverName', 'driverMobileNumber', 'driverLicenseNumber' 
                  // Removed extra fields: 'driverLicenseExpiryDate', 'driverAddress', 'driverExperience'
                ].includes(field))
                .map(([field, data]) => (
                  <TableRow key={field} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell component="th" scope="row">
                      {getFieldLabel(field)}
                    </TableCell>
                    <TableCell>
                      {data.operatorValue}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexDirection="column" alignItems="center">
                        <IconButton 
                          onClick={() => verifyField(field)}
                          color={data.isVerified ? "success" : "default"}
                          size="small"
                        >
                          {data.isVerified ? <CheckCircle /> : <RadioButtonUnchecked />}
                        </IconButton>
                        <TextField
                          size="small"
                          placeholder="Add comment"
                          value={data.comment}
                          onChange={(e) => handleCommentChange(field, e.target.value)}
                          variant="standard"
                          sx={{ mt: 1, width: '100%' }}
                          InputProps={{
                            endAdornment: data.comment ? (
                              <InputAdornment position="end">
                                <IconButton 
                                  onClick={() => handleCommentChange(field, '')}
                                  edge="end"
                                  size="small" 
                                >
                                  <Close fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ) : null,
                          }}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Driver's photo verification */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Driver's Photo Verification
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Original driver photo */}
            {session.images?.driverPicture && (
              <Box sx={{ width: '150px' }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Driver photo:
                </Typography>
                <Box sx={{ border: '1px solid #ddd', borderRadius: 1, overflow: 'hidden' }}>
                  <img 
                    src={session.images.driverPicture} 
                    alt="Driver" 
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </Box>
              </Box>
            )}
            
            {/* Verification radio button and comment */}
            <Box sx={{ flex: 1 }}>
              <Box display="flex" alignItems="center">
                <IconButton 
                  onClick={() => verifyImage('driverPicture')}
                  color={imageVerificationStatus.driverPicture ? "success" : "default"}
                  size="small"
                >
                  {imageVerificationStatus.driverPicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                </IconButton>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  Mark as verified
                </Typography>
              </Box>
              <TextField
                fullWidth
                size="small"
                placeholder="Add comment"
                value={imageComments.driverPicture || ''}
                onChange={(e) => handleImageCommentChange('driverPicture', e.target.value)}
                variant="outlined"
                multiline
                rows={2}
                sx={{ mt: 2 }}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };`;

// Replace the entire driver details verification function with the fixed version
const renderDriverDetailsVerificationRegex = /\/\/ Driver Details Verification[\s\S]*?const renderDriverDetailsVerification = \(\) => \{[\s\S]*?\};/;
content = content.replace(renderDriverDetailsVerificationRegex, renderDriverDetailsVerificationFix);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed JSX syntax issues in client.tsx'); 