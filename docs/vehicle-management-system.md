# Vehicle Management System in CBUMS: Connecting Trip Management with Vehicle Records

## Introduction
In the CBUMS (Cargo Bulk Unit Management System), operators manage both trips and vehicles through an integrated approach. This article details how the Vehicle Records and Trip Management modules interact, the statuses that vehicles can have, and how this relationship streamlines the cargo management process.

## Vehicle Record Management

### Vehicle Status Types
Vehicles in the system can have three distinct statuses, each visually represented by a specific color:

1. **Active (Green)** - Vehicles that are operational and available for new trips
2. **Busy (Yellow)** - Vehicles currently assigned to an IN_PROGRESS session/trip
3. **Inactive (Red)** - Vehicles that have been deactivated and cannot be used for new trips

### Vehicle Registration Process
Vehicles can be added to the system in two ways:
- **Direct Entry**: Through the Vehicle Records tab, operators can manually add new vehicles
- **Auto-Generation**: When a new vehicle number is entered during trip creation, the system automatically creates a vehicle record

## Integration with Trip Management

### Creating New Trips
When an OPERATOR creates a new trip in the Loading Details section:

1. The Vehicle Number field acts as both an input field and a search interface
2. As the operator types, the system searches through existing active vehicles
3. Matching vehicles appear in a dropdown, showing their current status:
   - Active vehicles (green) can be selected
   - Busy vehicles (yellow) are shown but with a busy indicator
   - Inactive vehicles (red) appear but will trigger an error if selected

### Validation Rules
Several validation rules ensure data integrity:

1. If an inactive vehicle is selected, an error message appears: "Vehicle Selected is Inactive, please select an active vehicle"
2. If a busy vehicle is selected, an error message appears: "Vehicle Selected is Busy, please select an active vehicle"
3. When a trip is created with a vehicle, that vehicle's status automatically changes to "busy"
4. When a trip is completed, the vehicle status returns to "active" (unless manually deactivated)

### Benefits of This Approach
This integrated approach offers several advantages:

1. **Simplified Data Entry**: Operators don't need to pre-register every vehicle before use
2. **Data Consistency**: Vehicle numbers are standardized across the system
3. **Error Prevention**: The system prevents using inactive or already-in-use vehicles
4. **Visual Status Identification**: Color-coded statuses make it easy to identify vehicle availability
5. **Automatic Record Creation**: New vehicles are automatically added to the database when first used
6. **Double-Booking Prevention**: The busy status prevents the same vehicle from being assigned to multiple active trips simultaneously

## Practical Application

### Scenario 1: Using an Existing Vehicle
When an operator needs to create a trip with a previously used vehicle:
1. They begin typing the vehicle number in the Vehicle Number field
2. The system displays matching vehicles with their status indicators
3. The operator selects an appropriate active (green) vehicle
4. If they mistakenly select a busy vehicle, the system displays: "Vehicle Selected is Busy, please select an active vehicle"
5. Upon successful trip creation, the vehicle status changes to "busy" (yellow)

### Scenario 2: Registering a New Vehicle
When a new vehicle needs to be used for the first time:
1. The operator enters the complete vehicle number
2. The system recognizes it as new and creates a basic vehicle record with "active" status
3. The trip is created with this new vehicle
4. The vehicle status is set to "busy"
5. Additional vehicle details can be added later through the Vehicle Records tab

### Scenario 3: Managing Vehicle Lifecycle
To manage vehicles over time:
1. Operators can view all vehicles in the Vehicle Records tab
2. They can update vehicle information or change status
3. Deactivating a vehicle prevents its use in future trips
4. Vehicles showing as "busy" indicate they're currently in transit with cargo
5. Attempting to use a busy vehicle for a new trip will trigger the validation error
6. When a trip is completed, the vehicle automatically becomes "active" again and available for new assignments

## Conclusion
The integration between Trip Management and Vehicle Records in CBUMS creates a fluid, error-resistant system that balances ease of use with data integrity. The color-coded status system (green for active, yellow for busy, red for inactive) provides immediate visual feedback about vehicle availability.

The validation rules prevent operational errors by ensuring that:
- Inactive vehicles cannot be used for new trips
- Busy vehicles cannot be double-booked for multiple trips
- Only active vehicles can be selected for new cargo assignments

This comprehensive approach ensures that operators can quickly create trips while maintaining accurate vehicle status information throughout the cargo transportation lifecycle.
