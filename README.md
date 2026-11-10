# Smart Lost & Found Portal

A comprehensive web application for managing lost and found items on a college campus, built with React, TypeScript, Firebase, and AI-powered image analysis.

## Features

### 🔐 Authentication
- Email and phone number authentication via Firebase Auth
- Secure OTP verification system
- User profile management

### 📱 Found Item Submission
- Image upload functionality
- AI-powered image classification
- Location and description capture
- Automatic item tagging and categorization

### 🔍 Lost Item Search
- Advanced search and filtering system
- AI-powered item matching
- Real-time match notifications
- Responsive card-based layout

### ✅ Claim Process
- Secure OTP verification via email
- Identity verification system
- Automatic status updates
- Claim history tracking

### 🤖 AI-Powered Matching
- Image similarity analysis using TensorFlow.js
- Automatic match detection
- Real-time notifications via Firebase Cloud Messaging
- Fallback to local analysis if API fails

### 👨‍💼 Admin Dashboard
- Item approval and rejection system
- User management
- Analytics and reporting
- Duplicate detection

### 🔔 Notification System
- Real-time push notifications
- Email notifications for important events
- In-app notification center
- Customizable notification preferences

## Technology Stack

### Frontend
- React 18 with TypeScript
- Tailwind CSS
- React Router
- React Hook Form with Yup validation
- Date-fns
- Lucide React
- React Hot Toast

### Backend
- Firebase Authentication
- Cloud Firestore
- Firebase Storage / Cloudinary (as configured in the project)
- Firebase Cloud Functions
- Firebase Cloud Messaging
- Firebase Hosting

### AI/ML
- Google Vision API
- TensorFlow.js
- Gemini API (optional)

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm
- Firebase CLI (if using Firebase deployment)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/ankitasawant23/SmartLost-Found-.git
cd SmartLost-Found-
```

2. Install dependencies:

```bash
npm install
```

3. Configure Firebase and other required services.

4. Configure environment variables if required:

```bash
cp .env.example .env
```

5. Start the development server:

```bash
npm run dev
```

## Firebase Setup

1. Create a Firebase project.
2. Enable the required services:
   - Authentication
   - Cloud Firestore
   - Cloud Messaging
   - Cloud Functions (if used)
3. Configure Firebase credentials.
4. Deploy Firestore rules and indexes if required:

```bash
firebase deploy --only firestore
```

5. Deploy Cloud Functions if configured:

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

## Project Structure

```text
Smart-Lost-and-Found-main/
│
├── public/
│   └── firebase-messaging-sw.js
│
├── src/
│   ├── components/
│   ├── contexts/
│   ├── lib/
│   ├── pages/
│   ├── types/
│   ├── utils/
│   └── App.tsx
│
├── functions/
│   ├── src/
│   └── package.json
│
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── package.json
└── README.md
```

*Note: The project structure above is a general overview. Actual folders may differ based on the current implementation.*

## Key Features Implementation

### Image Analysis

The application can use image analysis services to identify objects and generate labels for uploaded images.

### Item Matching

The matching system compares item details and image information to identify potentially matching lost and found items.

### Real-Time Notifications

Firebase Cloud Messaging can be used to deliver notifications about important item updates and potential matches.

## Security

- Firebase Authentication for user authentication.
- Firestore security rules for database access control.
- Secure handling of API keys and environment variables.
- Role-based access control for administrative features.

## Deployment

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Firebase Hosting

```bash
firebase deploy --only hosting
```

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push to the branch.
5. Create a Pull Request.

## License

This project is licensed under the MIT License.

## Support

For support, please create an issue in the GitHub repository.