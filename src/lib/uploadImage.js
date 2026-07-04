import { storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

function uploadToPath(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      'state_changed',
      snap => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export function uploadProductImage(productId, file, onProgress) {
  return uploadToPath(`products/${productId}/${Date.now()}-${file.name}`, file, onProgress);
}

export function uploadPackImage(packId, file, onProgress) {
  return uploadToPath(`packs/${packId}/${Date.now()}-${file.name}`, file, onProgress);
}
