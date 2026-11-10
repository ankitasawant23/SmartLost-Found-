import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
} from 'firebase/auth';

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

import { Search, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';

const emailSchema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

const phoneSchema = yup.object({
  phone: yup
    .string()
    .matches(/^\+[1-9]\d{7,14}$/, 'Enter phone number with country code, e.g. +919876543210')
    .required('Phone number is required'),
  otp: yup.string().when('$showOTP', {
    is: true,
    then: (schema) =>
      schema
        .required('OTP is required')
        .matches(/^\d{6}$/, 'OTP must contain 6 digits'),
    otherwise: (schema) => schema.optional(),
  }),
});

type EmailFormData = {
  email: string;
  password: string;
};

type PhoneFormData = {
  phone: string;
  otp?: string;
};

const LoginPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [showOTP, setShowOTP] = useState(false);
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const emailForm = useForm<EmailFormData>({
    resolver: yupResolver(emailSchema),
    mode: 'onChange',
  });

  const phoneForm = useForm<PhoneFormData>({
    resolver: yupResolver(phoneSchema),
    context: { showOTP },
    mode: 'onChange',
  });

  const getFirebaseErrorMessage = (error: unknown, fallback: string) => {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';

    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email किंवा password चुकीचा आहे. तपासा किंवा आधी Sign Up करा.';
      case 'auth/email-already-in-use':
        return 'हा email आधीच registered आहे. Sign In करा.';
      case 'auth/weak-password':
        return 'Password किमान 6 characters चा ठेवा.';
      case 'auth/invalid-email':
        return 'योग्य email address टाका.';
      case 'auth/operation-not-allowed':
        return 'Firebase Console मध्ये हा sign-in method enable करा.';
      case 'auth/too-many-requests':
        return 'खूप प्रयत्न झाले. थोड्या वेळाने पुन्हा प्रयत्न करा.';
      case 'auth/invalid-phone-number':
        return 'Phone number country code सहित टाका. उदाहरण: +919876543210';
      case 'auth/invalid-verification-code':
        return 'OTP चुकीचा आहे. पुन्हा तपासा.';
      case 'auth/code-expired':
        return 'OTP expire झाला आहे. नवीन OTP मागवा.';
      case 'auth/unauthorized-domain':
        return 'Firebase Authentication settings मध्ये या website domain ला authorize करा.';
      case 'auth/quota-exceeded':
        return 'SMS quota संपला आहे. Firebase Console मधील quota तपासा.';
      default:
        if (code === 'permission-denied' || code === 'firestore/permission-denied') {
          return 'Firestore permission नाकारली. Firebase Console → Firestore Database → Rules तपासा.';
        }
        return error instanceof Error ? error.message : fallback;
    }
  };

  const handleEmailAuth = async (data: EmailFormData) => {
    setLoading(true);

    try {
      const email = data.email.trim().toLowerCase();

      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, data.password);
        toast.success('Logged in successfully!');
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          data.password
        );

        const newUser = userCredential.user;

        // The account is created in Firebase Authentication first.
        // Firestore rules must allow this user to create their own profile.
        try {
          await setDoc(doc(db, 'users', newUser.uid), {
            uid: newUser.uid,
            email: newUser.email,
            role: 'user',
            isAdmin: false,
            createdAt: serverTimestamp(),
          });
          toast.success('Account created successfully!');
        } catch (profileError) {
          console.error('User profile could not be saved to Firestore:', profileError);
          toast.error(
            'Account created, but profile save failed. Check Firestore Rules; do not sign up repeatedly.'
          );
        }
      }
    } catch (error: unknown) {
      console.error('Email authentication error:', error);
      toast.error(getFirebaseErrorMessage(error, 'Authentication failed.'));
    } finally {
      setLoading(false);
    }
  };

  const clearRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch (error) {
        console.warn('Could not clear reCAPTCHA verifier:', error);
      }
      recaptchaVerifierRef.current = null;
    }
  };

  const handlePhoneAuth = async (data: PhoneFormData) => {
    setLoading(true);

    try {
      if (!showOTP) {
        const recaptchaContainer = document.getElementById('recaptcha-container');
        if (!recaptchaContainer) {
          throw new Error('reCAPTCHA container not found. Reload the page and try again.');
        }

        // Avoid creating multiple verifiers when the user retries.
        clearRecaptcha();
        const verifier = new RecaptchaVerifier(auth, recaptchaContainer, {
          size: 'invisible',
        });
        recaptchaVerifierRef.current = verifier;

        const confirmation = await signInWithPhoneNumber(
          auth,
          data.phone.trim(),
          verifier
        );

        setConfirmationResult(confirmation);
        setShowOTP(true);
        toast.success('OTP sent successfully!');
      } else {
        if (!confirmationResult || !data.otp) {
          throw new Error('Please request an OTP first.');
        }

        const userCredential = await confirmationResult.confirm(data.otp.trim());
        const signedInUser = userCredential.user;

        // Authentication succeeded even if writing the optional profile fails.
        try {
          await setDoc(
            doc(db, 'users', signedInUser.uid),
            {
              uid: signedInUser.uid,
              email: signedInUser.email,
              phoneNumber: signedInUser.phoneNumber,
              role: 'user',
              isAdmin: false,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
          toast.success('Phone verification successful!');
        } catch (profileError) {
          console.error('Phone verified, but Firestore profile save failed:', profileError);
          toast.error('Phone verified, but profile save failed. Check Firestore Rules.');
        }

        setShowOTP(false);
        setConfirmationResult(null);
        phoneForm.reset();
        clearRecaptcha();
      }
    } catch (error: unknown) {
      console.error('Phone authentication error:', error);
      toast.error(getFirebaseErrorMessage(error, 'Phone authentication failed.'));
      // A failed reCAPTCHA/OTP-send attempt should be allowed to retry cleanly.
      if (!showOTP) clearRecaptcha();
    } finally {
      setLoading(false);
    }
  };

  const switchAuthMethod = (method: 'email' | 'phone') => {
    setLoginMethod(method);
    setShowOTP(false);
    setConfirmationResult(null);
    clearRecaptcha();
    phoneForm.reset();
  };

  const toggleLoginMode = () => {
    setIsLogin((previous) => !previous);
    setShowOTP(false);
    setConfirmationResult(null);
    clearRecaptcha();
    emailForm.reset();
    phoneForm.reset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Search className="w-8 h-8 text-white" />
          </div>

          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Access your Lost & Found Portal
          </p>
        </div>

        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => switchAuthMethod('email')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginMethod === 'email'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email</span>
          </button>

          <button
            type="button"
            onClick={() => switchAuthMethod('phone')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginMethod === 'phone'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>Phone</span>
          </button>
        </div>

        {loginMethod === 'email' && (
          <form
            onSubmit={emailForm.handleSubmit(handleEmailAuth)}
            className="space-y-4"
          >
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>

              <input
                id="email"
                {...emailForm.register('email')}
                type="email"
                autoComplete="email"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
              />

              {emailForm.formState.errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {emailForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>

              <input
                id="password"
                {...emailForm.register('password')}
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
              />

              {emailForm.formState.errors.password && (
                <p className="mt-1 text-sm text-red-600">
                  {emailForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>
        )}

        {loginMethod === 'phone' && (
          <form
            onSubmit={phoneForm.handleSubmit(handlePhoneAuth)}
            className="space-y-4"
          >
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>

              <input
                id="phone"
                {...phoneForm.register('phone')}
                type="tel"
                autoComplete="tel"
                disabled={showOTP}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="+919876543210"
              />

              {phoneForm.formState.errors.phone && (
                <p className="mt-1 text-sm text-red-600">
                  {phoneForm.formState.errors.phone.message}
                </p>
              )}
            </div>

            {showOTP && (
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                  Verification Code
                </label>

                <input
                  id="otp"
                  {...phoneForm.register('otp')}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter 6-digit code"
                />

                {phoneForm.formState.errors.otp && (
                  <p className="mt-1 text-sm text-red-600">
                    {phoneForm.formState.errors.otp.message}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : showOTP ? 'Verify Code' : 'Send Code'}
            </button>

            {showOTP && (
              <button
                type="button"
                onClick={() => {
                  setShowOTP(false);
                  setConfirmationResult(null);
                  clearRecaptcha();
                  phoneForm.reset();
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-700"
              >
                Use a different phone number
              </button>
            )}
          </form>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={toggleLoginMode}
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </div>

        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
};

export default LoginPage;
