import React, { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import modalStyles from "../modalGlobal.module.css";
import scannerStyles from "./scanner.module.css";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import UploadIcon from "@mui/icons-material/Upload";
import SwitchCameraIcon from "@mui/icons-material/SwitchCamera";

export default function ModalScanner({
  onClose,
  onQRCodeRead = () => {},
  userData,
}) {
  const [scanResult, setScanResult] = useState("");
  const [useCamera, setUseCamera] = useState(true);
  const [paymentData, setPaymentData] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const startCamera = async () => {
      if (videoRef.current) {
        try {
          streamRef.current = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
          });
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play();
        } catch (error) {
          console.error("Erro ao acessar a câmera:", error);
          alert("Erro ao acessar a câmera. Verifique as permissões.");
        }
      }
    };

    const stopCamera = () => {
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    if (useCamera) {
      startCamera();
      intervalRef.current = setInterval(handleScan, 100);
    } else {
      stopCamera();
      clearInterval(intervalRef.current);
    }

    return () => {
      stopCamera();
      clearInterval(intervalRef.current);
    };
  }, [useCamera, facingMode]);

  const handleScan = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const video = videoRef.current;

    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const qrCode = jsQR(imageData.data, canvas.width, canvas.height);
      if (qrCode) {
        handleScanResult(qrCode.data);
      }
    }
  };

  const handleScanResult = (qrData) => {
    setScanResult(qrData);
    try {
      const parsedData = JSON.parse(qrData);
      const currentDate = new Date();
      const validUntil = new Date(parsedData.validUntil);

      if (validUntil < currentDate) {
        alert("QR Code expirado ou inválido.");
        return;
      }

      setPaymentData(parsedData);
      onQRCodeRead(qrData);
      setUseCamera(false);
    } catch (error) {
      alert("Erro ao ler o QR Code: Formato inválido.");
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imgElement = document.createElement("img");
        imgElement.src = e.target.result;
        imgElement.onload = () => {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = imgElement.width;
          canvas.height = imgElement.height;
          context.drawImage(imgElement, 0, 0);
          const imageData = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          );
          const qrCode = jsQR(imageData.data, canvas.width, canvas.height);
          if (qrCode) {
            handleScanResult(qrCode.data);
          } else {
            alert("QR Code não encontrado.");
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleCamera = async () => {
    await stopCamera();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    await startCamera();
  };

  const handlePayment = async () => {
    if (!paymentData) return;

    const transaction = {
      fromAccount: userData.accountNumber,
      toAccount: paymentData.accountNumber,
      value: paymentData.value,
      description: paymentData.description || "Pagamento via QR Code",
      transactionId: paymentData.transactionId,
      validUntil: paymentData.validUntil,
      userName: paymentData.userName,
    };

    try {
      const response = await fetch(
        "https://projeto-final-m5-api.onrender.com/api/transactions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(transaction),
        }
      );

      if (response.ok) {
        alert("Pagamento confirmado!");
        onClose();
      } else {
        const error = await response.json();
        alert(`Erro: ${error.message}`);
      }
    } catch (error) {
      console.error("Erro na transação:", error);
      alert("Erro ao processar a transação. Tente novamente.");
    }
  };

  const handleCancelPayment = () => {
    setPaymentData(null);
    setUseCamera(true);
    setScanResult("");
  };

  const handleClose = () => {
    setUseCamera(false);
    onClose();
  };

  return (
    <div className={modalStyles.modal}>
      {paymentData ? (
        <div className={scannerStyles.paymentOverlay}>
          <h2>Dados do Pagamento:</h2>
          <div className={scannerStyles.paymentInfo}>
            <p><strong>Nome do Recebedor:</strong> {paymentData.userName}</p>
            <p><strong>Conta:</strong> {paymentData.accountNumber}</p>
            <p><strong>Valor:</strong> R$ {paymentData.value}</p>
            <p><strong>Descrição:</strong> {paymentData.description}</p>
            <p><strong>ID Transação:</strong> {paymentData.transactionId}</p>
            <p><strong>Validade:</strong> {paymentData.validUntil}</p>
          </div>
          <div className={scannerStyles.paymentButtons}>
            <button onClick={handlePayment} className={scannerStyles.confirmButton}>
              Confirmar
            </button>
            <button onClick={handleCancelPayment} className={scannerStyles.cancelButton}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          {useCamera ? (
            <>
              <video ref={videoRef} className={scannerStyles.videoBackground} autoPlay />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div className={scannerStyles.videoOverlay}></div>
            </>
          ) : (
            <label className={scannerStyles.fileInputLabel}>
              <input type="file" accept="image/*" onChange={handleFileChange} />
              <span>Carregar Imagem</span>
            </label>
          )}
          <div className={scannerStyles.controls}>
            <button onClick={toggleCamera}>
              <SwitchCameraIcon />
            </button>
            <button onClick={handleClose}>
              <ArrowBackIosNewRoundedIcon />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
