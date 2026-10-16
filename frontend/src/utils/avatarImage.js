const MAX_EDGE = 256;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

export function compressAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
      reject(new Error('请上传 JPG、PNG 或 WebP 图片'));
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      reject(new Error('图片不能超过 8MB'));
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#f4f1ea';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('图片处理失败'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('图片处理失败'));
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.82);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('这张图片无法读取'));
    };
    image.src = url;
  });
}
