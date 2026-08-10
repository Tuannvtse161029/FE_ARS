declare module '*firebase' {
  import type { FirebaseStorage } from 'firebase/storage';
  export const storage: FirebaseStorage;
}
