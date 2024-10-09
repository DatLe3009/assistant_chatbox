import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';

const FaceDetection = ({setIsSleeping}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Load các model của face-api.js
    const loadModels = async () => {
      const MODEL_URL = '/models';  // Thư mục chứa các model
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
    };

    // Khởi động camera
    const startVideo = () => {
      navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
          videoRef.current.srcObject = stream;
        })
        .catch(err => console.error('Error accessing webcam: ', err));
    };

    // Chờ load xong model rồi khởi động camera
    loadModels().then(() => startVideo());

    const detectFaces = async () => {
      const displaySize = { width: videoRef.current.width, height: videoRef.current.height };
      faceapi.matchDimensions(canvasRef.current, displaySize);

      setInterval(async () => {
        const detections = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        );

        // const resizedDetections = faceapi.resizeResults(detections, displaySize);

        // Vẽ bounding box quanh khuôn mặt
        // const context = canvasRef.current.getContext('2d');
        // context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        // faceapi.draw.drawDetections(canvasRef.current, resizedDetections);

        if (detections.length > 0) {
            setIsSleeping(false);

            // Nếu đã có timeout đang đếm ngược để chuyển sang "Không có người", hủy nó
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        } else {
            // Chỉ khi không có khuôn mặt, bắt đầu hẹn giờ đợi 10s để chuyển trạng thái
            if (!timeoutRef.current) {
                timeoutRef.current = setTimeout(() => {
                  setIsSleeping(true);
                  timeoutRef.current = null;
            }, 3000);
            }  
        }
      }, 100);
    };

    // Bắt đầu phát hiện khi video bắt đầu chạy
    if (modelsLoaded) {
      videoRef.current && videoRef.current.addEventListener('play', detectFaces);
    }
  }, [modelsLoaded]);

  return (
    <div style={{  opacity: 0, position: 'absolute'}}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <video ref={videoRef} width="100%" height="100%" autoPlay muted style={{ position: 'absolute' }} />
        <canvas ref={canvasRef} width="100%" height="100%" style={{ position: 'absolute' }} />
      </div>
    </div>
  );
};

export default FaceDetection;
