import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCgIlFcdp9kgCpog6U_UmnYqhoqr680UII',
  authDomain: 'appointment-1f453.firebaseapp.com',
  projectId: 'appointment-1f453',
  storageBucket: 'appointment-1f453.firebasestorage.app',
  messagingSenderId: '644537798869',
  appId: '1:644537798869:web:e859df6f06691570f8d25c',
  measurementId: 'G-R6371NE7CZ',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
