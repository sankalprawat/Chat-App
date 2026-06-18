import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyBc3kfw7Cwse9K6-gJ52HFoG-xXNgXCcEk",
  authDomain: "chatapp-bbe98.firebaseapp.com",
  projectId: "chatapp-bbe98",
  storageBucket: "chatapp-bbe98.firebasestorage.app",
  messagingSenderId: "516137651835",
  appId: "1:516137651835:web:54e34aee8af47fee399cde",
  measurementId: "G-ZQP098ZHDE"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app)
// console.log(auth);

const googleProvider = new GoogleAuthProvider();
// console.log(googleProvider);

export const signInWithGoogle = async () => {
    const googleUser = await signInWithPopup(auth, googleProvider)
    // console.log("googleUser", googleUser);
    return googleUser.user;
}