"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { resizeAndCompressImage } from "@/lib/imageUtils";
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  List, 
  ListItem, 
  ListItemText, 
  Avatar, 
  Divider,
  CircularProgress,
  Paper,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Alert
} from "@mui/material";
import { 
  Comment, 
  Send, 
  Photo, 
  Close,
  PhotoCamera,
  Flag,
  DeleteOutline,
  Warning,
  Error,
  Info
} from "@mui/icons-material";
import { UserRole } from "@/prisma/enums";

type UserType = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type CommentType = {
  id: string;
  message: string;
  imageUrl?: string | null;
  urgency: string;
  createdAt: string;
  user: UserType;
};

type CommentSectionProps = {
  sessionId: string;
};

export default function CommentSection({ sessionId }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentType[]>([]);
  const [message, setMessage] = useState("");
  const [urgency, setUrgency] = useState<string>("NA");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchComments = useCallback(async () => {
    if (!sessionId) {
      console.log("No session ID for comments, skipping fetch");
      setIsFetching(false);
      return;
    }
    
    setIsFetching(true);
    setError("");
    
    try {
      console.log("Fetching comments for session:", sessionId);
      const response = await fetch(`/api/comments?sessionId=${sessionId}`);
      
      if (!response.ok) {
        console.error(`Comments API Error (${response.status}):`, await response.text());
        throw new Error("Failed to fetch comments");
      }
      
      const data = await response.json();
      console.log(`Loaded ${data.length} comments`);
      setComments(data);
      setLoadFailed(false);
    } catch (err) {
      console.error("Error fetching comments:", err);
      setError("Failed to load comments");
      setLoadFailed(true);
    } finally {
      setIsFetching(false);
    }
  }, [sessionId]);
  
  useEffect(() => {
    if (sessionId) {
      fetchComments();
    }
  }, [sessionId, fetchComments]);

  // Handle image selection
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }

    try {
    const file = e.target.files[0];
      // Compress the image before setting it
      const compressedImage = await resizeAndCompressImage(file);
      setSelectedImage(compressedImage);

    // Create and set image preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
      reader.readAsDataURL(compressedImage);
    } catch (error) {
      console.error("Error processing image:", error);
      toast.error("Failed to process image. Please try with a smaller image.");
    }
  };

  // Remove selected image
  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() && !selectedImage) {
      return; // Require either message or image
    }
    
    setIsLoading(true);
    setError("");

    try {
      // Create FormData if there's an image
      if (selectedImage) {
        const formData = new FormData();
        formData.append("sessionId", sessionId);
        formData.append("message", message.trim() || ""); // Use empty string if no message
        formData.append("urgency", urgency);
        formData.append("image", selectedImage);

        const response = await fetch("/api/comments", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 413) {
            throw new Error(errorData.error || "Image is too large. Please use a smaller image (max 5MB).");
          } else {
            throw new Error(errorData.error || "Failed to add comment");
          }
        }

        const newComment = await response.json();
        setComments((prev) => [newComment, ...prev]);
      } else {
        // Standard JSON request for text-only comments
        const response = await fetch("/api/comments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            message: message.trim(),
            urgency
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to add comment");
        }

        const newComment = await response.json();
        setComments((prev) => [newComment, ...prev]);
      }

      // Reset form
      setMessage("");
      setUrgency("NA");
      setSelectedImage(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error("Error adding comment:", err);
      setError("Failed to add comment");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Get avatar color based on user role
  const getAvatarColor = (role: string) => {
    switch (role) {
      case UserRole.SUPERADMIN:
        return "#f44336"; // red
      case UserRole.ADMIN:
        return "#3f51b5"; // indigo
      case UserRole.COMPANY:
        return "#4caf50"; // green
      case UserRole.EMPLOYEE:
        return "#ff9800"; // orange
      default:
        return "#9e9e9e"; // gray
    }
  };

  // Get color based on urgency
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "LOW":
        return "#EFCC00"; // Yellow gold
      case "MEDIUM":
        return "#FF4D04"; // Bright orange-red
      case "HIGH":
        return "#FF0000"; // Red
      default:
        return "inherit"; // Default color (black)
    }
  };

  const handleUrgencyChange = (event: SelectChangeEvent<string>) => {
    setUrgency(event.target.value);
  };

  return (
    <Paper sx={{ p: 2, mt: 3 }} variant="outlined">
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Comment color="action" sx={{ mr: 1 }} />
        <Typography variant="h6">Comments</Typography>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <form onSubmit={handleSendComment}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Add a comment..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isLoading}
          sx={{ mb: 2 }}
        />

        {/* Image preview area */}
        {imagePreview && (
          <Box sx={{ position: 'relative', width: 'fit-content', mt: 1, mb: 2 }}>
            <img 
              src={imagePreview} 
              alt="Selected" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '200px', 
                borderRadius: '4px' 
              }} 
            />
            <IconButton
              size="small"
              sx={{ 
                position: 'absolute', 
                top: -12, 
                right: -12, 
                bgcolor: 'white',
                '&:hover': { bgcolor: 'white' }
              }}
              onClick={handleRemoveImage}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>
        )}

        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              id="image-upload"
              onChange={handleImageSelect}
              ref={fileInputRef}
            />
            <label htmlFor="image-upload">
              <Tooltip title="Attach image">
                <IconButton 
                  component="span" 
                  color="primary"
                  disabled={isLoading}
                >
                  <PhotoCamera />
                </IconButton>
              </Tooltip>
            </label>
            
            <FormControl size="small" sx={{ width: 150, ml: 1 }}>
              <InputLabel id="urgency-label">Urgency</InputLabel>
              <Select
                labelId="urgency-label"
                value={urgency}
                label="Urgency"
                onChange={handleUrgencyChange}
                disabled={isLoading}
                startAdornment={
                  <Flag sx={{ 
                    color: getUrgencyColor(urgency),
                    mr: 1,
                    fontSize: '1.2rem'
                  }} />
                }
              >
                <MenuItem value="NA">--NA--</MenuItem>
                <MenuItem value="LOW">
                  <Typography sx={{ color: "#EFCC00" }}>
                    Low
                  </Typography>
                </MenuItem>
                <MenuItem value="MEDIUM">
                  <Typography sx={{ color: "#FF4D04" }}>
                    Medium
                  </Typography>
                </MenuItem>
                <MenuItem value="HIGH">
                  <Typography sx={{ color: "#FF0000" }}>
                    High
                  </Typography>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={(!(message.trim() || selectedImage)) || isLoading}
            endIcon={isLoading ? <CircularProgress size={20} /> : <Send />}
          >
            Send
          </Button>
        </Box>
      </form>

      <List sx={{ mt: 2 }}>
        {isFetching ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
            <CircularProgress />
          </Box>
        ) : comments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
            No comments yet
          </Typography>
        ) : (
          comments.map((comment, index) => (
            <Box key={comment.id}>
              <ListItem alignItems="flex-start">
                <Avatar
                  sx={{ 
                    mr: 2, 
                    bgcolor: getAvatarColor(comment.user.role),
                    width: 36,
                    height: 36
                  }}
                >
                  {getInitials(comment.user.name)}
                </Avatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography component="span" variant="subtitle2">
                        {comment.user.name}
                      </Typography>
                      <Typography component="span" variant="caption" color="text.secondary">
                        {formatDate(comment.createdAt)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography
                        component="span"
                        variant="body2"
                        color={comment.urgency !== "NA" ? getUrgencyColor(comment.urgency) : "text.primary"}
                        sx={{ 
                          display: "block", 
                          mt: 1,
                          fontWeight: comment.urgency !== "NA" ? 500 : 400
                        }}
                      >
                        {comment.message}
                      </Typography>
                      
                      {/* Display image if present */}
                      {comment.imageUrl && (
                        <Box sx={{ mt: 1 }}>
                          <img 
                            src={comment.imageUrl} 
                            alt="Comment attachment" 
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '300px',
                              borderRadius: '4px'
                            }} 
                          />
                        </Box>
                      )}
                      
                      <Box sx={{ display: "flex", mt: 0.5, alignItems: "center" }}>
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                        >
                          {comment.user.role}
                        </Typography>
                        
                        {comment.urgency !== "NA" && (
                          <Box sx={{ 
                            display: "flex", 
                            alignItems: "center", 
                            ml: 1,
                            color: getUrgencyColor(comment.urgency)
                          }}>
                            <Flag fontSize="small" sx={{ mr: 0.5, fontSize: '0.8rem' }} />
                            <Typography variant="caption">
                              {comment.urgency === "LOW" ? "Low" : 
                               comment.urgency === "MEDIUM" ? "Medium" : 
                               comment.urgency === "HIGH" ? "High" : ""}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </>
                  }
                />
              </ListItem>
              {index < comments.length - 1 && <Divider variant="inset" component="li" />}
            </Box>
          ))
        )}
      </List>
    </Paper>
  );
} 