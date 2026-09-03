import { useEffect, useRef, useState } from "react";
import { classifyWaste } from "./api";
import {
  Leaf,
  Recycle,
  ShieldAlert,
  Camera,
  Upload,
  X,
  CheckCircle2,
  LoaderCircle,
  ArrowRight,
  Sparkles,
  Trash2,
  AlertTriangle,
  History as HistoryIcon,
  LayoutDashboard,
  ScanLine,
  Clock3,
  BarChart3,
  RotateCcw,
} from "lucide-react";

const HISTORY_KEY = "eco-sort-history";

function App() {
  const [activePage, setActivePage] = useState("scan");
  const [selectedImage, setSelectedImage] = useState(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationResult, setClassificationResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);

      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error("Unable to load scan history:", error);
    }
  }, []);

  useEffect(() => {
    if (!isCameraOpen) return;

    let activeStream = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setErrorMessage(
            "Camera access is not supported by this browser. Please use a modern browser or upload an image instead."
          );
          setIsCameraOpen(false);
          return;
        }

        activeStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
          await videoRef.current.play();
        }
      } catch (error) {
        console.error("Camera access failed:", error);
        setErrorMessage(
          "Camera access was blocked or unavailable. Please allow camera permission and try again."
        );
        setIsCameraOpen(false);
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [isCameraOpen]);

  const openCamera = () => {
    setErrorMessage("");
    setIsCameraOpen(true);
  };

  const closeCamera = () => {
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      setErrorMessage("Camera is not ready yet. Please wait a moment and try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setErrorMessage("Unable to capture the camera image. Please try again.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErrorMessage("Unable to create the captured image. Please try again.");
          return;
        }

        if (selectedImage?.url) {
          URL.revokeObjectURL(selectedImage.url);
        }

        const file = new File(
          [blob],
          `camera-capture-${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );

        const imageUrl = URL.createObjectURL(file);

        setSelectedImage({
          file,
          url: imageUrl,
          name: file.name,
        });

        setClassificationResult(null);
        setErrorMessage("");
        setIsCameraOpen(false);
        setActivePage("scan");
      },
      "image/jpeg",
      0.92
    );
  };

  const handleCameraKeyDown = (event) => {
    if (event.key === "Escape") {
      closeCamera();
    }

    if (event.key === "Enter") {
      capturePhoto();
    }
  };

  const saveHistory = (newHistory) => {
    setHistory(newHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file.");
      return;
    }

    if (selectedImage?.url) {
      URL.revokeObjectURL(selectedImage.url);
    }

    const imageUrl = URL.createObjectURL(file);

    setSelectedImage({
      file,
      url: imageUrl,
      name: file.name,
    });

    setClassificationResult(null);
    setErrorMessage("");
    setActivePage("scan");
  };

  const removeImage = () => {
    if (selectedImage?.url) {
      URL.revokeObjectURL(selectedImage.url);
    }

    setSelectedImage(null);
    setClassificationResult(null);
    setErrorMessage("");
  };

  const handleClassify = async () => {
    if (!selectedImage?.file) return;

    try {
      setIsClassifying(true);
      setClassificationResult(null);
      setErrorMessage("");

      const result = await classifyWaste(selectedImage.file);

      console.log("Classification result:", result);

      setClassificationResult(result);

      const label =
        result?.label ||
        result?.category ||
        result?.class ||
        result?.prediction ||
        "Unknown";

      const confidenceValue =
        result?.confidence ??
        result?.score ??
        result?.probability ??
        null;

      let confidence = null;

      if (
        confidenceValue !== null &&
        confidenceValue !== undefined &&
        confidenceValue !== ""
      ) {
        const number = Number(confidenceValue);

        if (!Number.isNaN(number)) {
          confidence = Math.min(
            100,
            Math.max(0, number <= 1 ? number * 100 : number)
          );
        }
      }

      const historyItem = {
        id: Date.now(),
        label,
        confidence,
        fileName: selectedImage.name,
        timestamp: new Date().toISOString(),
      };

      const updatedHistory = [historyItem, ...history].slice(0, 50);

      saveHistory(updatedHistory);
    } catch (error) {
      console.error("Classification failed:", error);

      if (error.response) {
        setErrorMessage(
          error.response.data?.detail ||
            "The AI backend returned an error. Please try again."
        );
      } else if (error.request) {
        setErrorMessage(
          "Unable to connect to the AI backend. Make sure the backend is running."
        );
      } else {
        setErrorMessage("Something went wrong. Please try again.");
      }
    } finally {
      setIsClassifying(false);
    }
  };

  const getLabel = (result = classificationResult) => {
    return (
      result?.label ||
      result?.category ||
      result?.class ||
      result?.prediction ||
      "Result received"
    );
  };

  const getConfidence = (result = classificationResult) => {
    const value =
      result?.confidence ?? result?.score ?? result?.probability;

    if (value === undefined || value === null || value === "") {
      return null;
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
      return null;
    }

    const percentage = number <= 1 ? number * 100 : number;

    return Math.min(100, Math.max(0, percentage));
  };

  const clearHistory = () => {
    if (window.confirm("Clear all saved scan history?")) {
      localStorage.removeItem(HISTORY_KEY);
      setHistory([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button
            type="button"
            onClick={() => setActivePage("scan")}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <Leaf size={24} />
            </div>

            <div>
              <h1 className="text-xl font-black tracking-tight">
                ECO-SORT AI
              </h1>

              <p className="text-xs font-medium text-slate-500">
                See Waste. Know Waste. Sort Right.
              </p>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-2 md:flex">
            <NavButton
              active={activePage === "scan"}
              icon={<ScanLine size={17} />}
              onClick={() => setActivePage("scan")}
            >
              Scan
            </NavButton>

            <NavButton
              active={activePage === "history"}
              icon={<HistoryIcon size={17} />}
              onClick={() => setActivePage("history")}
            >
              History
            </NavButton>

            <NavButton
              active={activePage === "dashboard"}
              icon={<LayoutDashboard size={17} />}
              onClick={() => setActivePage("dashboard")}
            >
              Dashboard
            </NavButton>
          </nav>
        </div>

        {/* Mobile Navigation */}
        <div className="border-t border-slate-100 px-4 py-2 md:hidden">
          <div className="mx-auto flex max-w-md justify-between">
            <MobileNavButton
              active={activePage === "scan"}
              icon={<ScanLine size={17} />}
              onClick={() => setActivePage("scan")}
            >
              Scan
            </MobileNavButton>

            <MobileNavButton
              active={activePage === "history"}
              icon={<HistoryIcon size={17} />}
              onClick={() => setActivePage("history")}
            >
              History
            </MobileNavButton>

            <MobileNavButton
              active={activePage === "dashboard"}
              icon={<LayoutDashboard size={17} />}
              onClick={() => setActivePage("dashboard")}
            >
              Dashboard
            </MobileNavButton>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-12">
        {activePage === "scan" && (
          <ScanPage
            selectedImage={selectedImage}
            isClassifying={isClassifying}
            classificationResult={classificationResult}
            errorMessage={errorMessage}
            handleImageChange={handleImageChange}
            removeImage={removeImage}
            handleClassify={handleClassify}
            getLabel={getLabel}
            getConfidence={getConfidence}
            setActivePage={setActivePage}
            openCamera={openCamera}
            isCameraOpen={isCameraOpen}
            closeCamera={closeCamera}
            capturePhoto={capturePhoto}
            videoRef={videoRef}
          />
        )}

        {activePage === "history" && (
          <HistoryPage
            history={history}
            clearHistory={clearHistory}
            setActivePage={setActivePage}
          />
        )}

        {activePage === "dashboard" && (
          <DashboardPage
            history={history}
            setActivePage={setActivePage}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-center sm:flex-row sm:text-left">
          <p className="text-sm font-semibold text-slate-600">
            ECO-SORT AI
          </p>

          <p className="text-sm text-slate-400">
            Smart waste classification for a cleaner future.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SCAN PAGE                                                                  */
/* -------------------------------------------------------------------------- */

function ScanPage({
  selectedImage,
  isClassifying,
  classificationResult,
  errorMessage,
  handleImageChange,
  removeImage,
  handleClassify,
  getLabel,
  getConfidence,
  setActivePage,
  openCamera,
  isCameraOpen,
  closeCamera,
  capturePhoto,
  videoRef,
}) {
  const label = getLabel();
  const confidence = getConfidence();
  const isLowConfidence =
    confidence !== null && confidence < 70 && classificationResult;

  const normalizedLabel = label.toLowerCase();

  const isHazardous = normalizedLabel.includes("hazard");
  const isOrganic = normalizedLabel.includes("organic");
  const isRecyclable = normalizedLabel.includes("recycl");

  const handleCameraKeyDown = (event) => {
    if (event.key === "Escape") {
      closeCamera();
    }

    if (event.key === "Enter") {
      capturePhoto();
    }
  };

  const getRecommendation = () => {
    if (isHazardous) {
      return {
        title: "Handle with care",
        description:
          "Do not mix this waste with regular household waste. Use an authorized hazardous-waste disposal method.",
        icon: <AlertTriangle size={22} />,
        className: "bg-amber-50 border-amber-200 text-amber-700",
      };
    }

    if (isOrganic) {
      return {
        title: "Use the organic waste bin",
        description:
          "This waste can be separated with biodegradable or compostable materials.",
        icon: <Leaf size={22} />,
        className:
          "bg-emerald-50 border-emerald-200 text-emerald-700",
      };
    }

    if (isRecyclable) {
      return {
        title: "Use the recyclable waste bin",
        description:
          "Keep recyclable material separated from organic and hazardous waste.",
        icon: <Recycle size={22} />,
        className: "bg-blue-50 border-blue-200 text-blue-700",
      };
    }

    return {
      title: "Follow the recommended disposal method",
      description:
        "Separate this item according to the waste classification provided by the AI system.",
      icon: <Trash2 size={22} />,
      className: "bg-slate-50 border-slate-200 text-slate-700",
    };
  };

  const recommendation = getRecommendation();

  return (
    <>
      {/* Hero */}
      <section className="pt-4 text-center sm:pt-8">
        <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
          <Sparkles size={17} />
          AI-Powered Waste Classification
        </div>

        <h2 className="mx-auto max-w-4xl text-3xl font-black sm:text-4xl leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
          Turn every piece of waste into the{" "}
          <span className="text-emerald-600">right decision.</span>
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
          Upload a waste image and ECO-SORT AI classifies it as
          recyclable, organic, or hazardous.
        </p>
      </section>

      {/* Camera Modal */}
      {isCameraOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Waste camera"
          onKeyDown={handleCameraKeyDown}
          tabIndex={-1}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-600">
                  Live Camera
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">
                  Capture waste image
                </h3>
              </div>

              <button
                type="button"
                onClick={closeCamera}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close camera"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-950 p-3 sm:p-5">
              <div className="relative overflow-hidden rounded-2xl bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-[4/3] w-full object-cover"
                />

                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-6 rounded-2xl border-2 border-white/50" />
                  <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                </div>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-xs font-bold text-white backdrop-blur">
                  Position the waste item inside the frame
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:justify-center sm:p-6">
              <button
                type="button"
                onClick={closeCamera}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-3.5 font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <X size={19} />
                Cancel
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
              >
                <Camera size={20} />
                Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scanner */}
      <section className="mx-auto mt-12 max-w-3xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-10">
          {!selectedImage ? (
            <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 px-6 py-12 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600">
                <Upload size={34} />
              </div>

              <h3 className="mt-6 text-2xl font-black">
                Upload waste image
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Choose a clear image of the waste item. Our AI will
                analyze it and suggest the correct disposal category.
              </p>

              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700">
                  <Upload size={19} />
                  Choose Image

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>

                <button
                  type="button"
                  onClick={openCamera}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <Camera size={19} />
                  Use Camera
                </button>
              </div>

              <p className="mt-4 text-xs text-slate-400">
                Supported formats: JPG, PNG, WEBP
              </p>
            </div>
          ) : (
            <div>
              {/* Selected Image Header */}
              <div className="mb-5 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-600">
                    Image ready
                  </p>

                  <h3 className="mt-1 text-xl font-black">
                    Analyze your waste
                  </h3>

                  <p className="mt-1 max-w-xs truncate text-sm text-slate-500">
                    {selectedImage.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={removeImage}
                  disabled={isClassifying}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Remove image"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Image Preview */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <img
                  src={selectedImage.url}
                  alt="Selected waste"
                  className="max-h-[420px] w-full object-contain"
                />
              </div>

              {/* Ready Message */}
              {!classificationResult && !isClassifying && (
                <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 size={18} />
                  Image ready for AI classification
                </div>
              )}

              {/* Classify Button */}
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={handleClassify}
                  disabled={isClassifying}
                  className="flex min-w-48 items-center justify-center gap-2 rounded-xl bg-slate-900 px-7 py-3.5 font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isClassifying ? (
                    <>
                      <LoaderCircle
                        size={19}
                        className="animate-spin"
                      />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={19} />
                      Classify Waste
                    </>
                  )}
                </button>
              </div>

              {/* Error */}
              {errorMessage && (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                  <AlertTriangle
                    size={20}
                    className="mt-0.5 shrink-0"
                  />

                  <div>
                    <p className="font-bold">Classification failed</p>

                    <p className="mt-1 text-sm leading-6">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              )}

              {/* Classification Result */}
              {classificationResult && (
                <div className="mt-8 overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-lg">
                  {/* Result Header */}
                  <div
                    className={`p-6 ${
                      isHazardous
                        ? "bg-amber-50"
                        : isOrganic
                          ? "bg-emerald-50"
                          : "bg-blue-50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md ${
                          isHazardous
                            ? "bg-amber-500"
                            : isOrganic
                              ? "bg-emerald-600"
                              : "bg-blue-600"
                        }`}
                      >
                        {isHazardous ? (
                          <ShieldAlert size={28} />
                        ) : isOrganic ? (
                          <Leaf size={28} />
                        ) : (
                          <Recycle size={28} />
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                          AI Classification
                        </p>

                        <h3 className="mt-1 text-3xl font-black text-slate-900">
                          {label}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Result Body */}
                  <div className="p-6">
                    {/* Confidence */}
                    {confidence !== null && (
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-600">
                            AI Confidence
                          </span>

                          <span className="text-sm font-black text-emerald-600">
                            {Math.round(confidence)}%
                          </span>
                        </div>

                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              isLowConfidence ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{
                              width: `${confidence}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Low Confidence Warning */}
                    {isLowConfidence && (
                      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
                        <AlertTriangle
                          size={22}
                          className="mt-0.5 shrink-0 text-amber-600"
                        />
                        <div>
                          <p className="font-black">Low confidence result</p>
                          <p className="mt-1 text-sm leading-6 text-amber-700">
                            The AI is not sufficiently certain about this
                            classification. Capture a clearer image or try
                            another angle before deciding how to dispose of
                            the item.
                          </p>
                        </div>
                      </div>
                    )}



                    {/* Recommendation */}
                    <div
                      className={`mt-6 rounded-2xl border p-5 ${recommendation.className}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {recommendation.icon}
                        </div>

                        <div>
                          <p className="font-black">
                            {recommendation.title}
                          </p>

                          <p className="mt-1 text-sm leading-6 opacity-80">
                            {recommendation.description}
                          </p>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
                    >
                      <RotateCcw size={18} />
                      Scan Another Item
                    </button>

                        </div>
                      </div>
                    </div>

                    {/* Result Status */}
                    <div className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-500">
                      <CheckCircle2
                        size={17}
                        className="text-emerald-500"
                      />
                      AI response received successfully
                    </div>

                    {/* Actions */}
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={removeImage}
                        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        Scan Another
                        <RotateCcw size={18} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setActivePage("history")}
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700"
                      >
                        View History
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Categories */}
      <section className="mt-16">
        <div className="mb-6 text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
            Smart Sorting
          </p>

          <h3 className="mt-2 text-2xl font-black sm:text-3xl">
            Three simple waste categories
          </h3>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
            ECO-SORT AI helps users understand where their waste belongs.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <Category
            icon={<Recycle size={24} />}
            title="Recyclable"
            description="Paper, plastic, glass and other recoverable materials."
            className="bg-blue-50 text-blue-600"
          />

          <Category
            icon={<Leaf size={24} />}
            title="Organic"
            description="Food scraps, garden waste and biodegradable materials."
            className="bg-emerald-50 text-emerald-600"
          />

          <Category
            icon={<ShieldAlert size={24} />}
            title="Hazardous"
            description="Waste requiring special handling for safe disposal."
            className="bg-amber-50 text-amber-600"
          />
        </div>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* HISTORY PAGE                                                               */
/* -------------------------------------------------------------------------- */

function HistoryPage({ history, clearHistory, setActivePage }) {
  return (
    <section className="mx-auto max-w-5xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
            <HistoryIcon size={17} />
            Scan History
          </div>

          <h2 className="mt-2 text-3xl font-black sm:text-4xl tracking-tight">
            Your recent scans
          </h2>

          <p className="mt-3 max-w-xl text-slate-500">
            Review previous waste classifications stored on this device.
          </p>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
          >
            <Trash2 size={17} />
            Clear History
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <HistoryIcon size={28} />
          </div>

          <h3 className="mt-5 text-xl font-black">
            No scans yet
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Your successful AI classifications will appear here.
          </p>

          <button
            type="button"
            onClick={() => setActivePage("scan")}
            className="mx-auto mt-6 flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700"
          >
            Start First Scan
            <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <div className="mt-10 space-y-4">
          {history.map((item) => (
            <HistoryCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function HistoryCard({ item }) {
  const label = item.label || "Unknown";
  const normalizedLabel = label.toLowerCase();

  const isHazardous = normalizedLabel.includes("hazard");
  const isOrganic = normalizedLabel.includes("organic");

  const icon = isHazardous ? (
    <ShieldAlert size={22} />
  ) : isOrganic ? (
    <Leaf size={22} />
  ) : (
    <Recycle size={22} />
  );

  const iconClass = isHazardous
    ? "bg-amber-50 text-amber-600"
    : isOrganic
      ? "bg-emerald-50 text-emerald-600"
      : "bg-blue-50 text-blue-600";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <h3 className="text-lg font-black">{label}</h3>

          <p className="mt-1 truncate text-sm text-slate-500">
            {item.fileName}
          </p>

          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <Clock3 size={14} />
            {formatDate(item.timestamp)}
          </div>
        </div>
      </div>

      {item.confidence !== null &&
        item.confidence !== undefined && (
          <div className="shrink-0">
            <p className="text-xs font-semibold text-slate-400">
              Confidence
            </p>

            <p className="mt-1 text-xl font-black text-emerald-600">
              {Math.round(item.confidence)}%
            </p>
          </div>
        )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* DASHBOARD PAGE                                                             */
/* -------------------------------------------------------------------------- */

function DashboardPage({ history, setActivePage }) {
  const totalScans = history.length;

  const recyclableCount = history.filter((item) =>
    item.label?.toLowerCase().includes("recycl")
  ).length;

  const organicCount = history.filter((item) =>
    item.label?.toLowerCase().includes("organic")
  ).length;

  const hazardousCount = history.filter((item) =>
    item.label?.toLowerCase().includes("hazard")
  ).length;

  const confidenceValues = history
    .map((item) => item.confidence)
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        !Number.isNaN(Number(value))
    );

  const categoriesScanned = new Set(
    history
      .map((item) => item.label?.toLowerCase() || "")
      .map((label) => {
        if (label.includes("recycl")) return "recyclable";
        if (label.includes("organic")) return "organic";
        if (label.includes("hazard")) return "hazardous";
        return null;
      })
      .filter(Boolean)
  );

  const baseScore = totalScans * 10;
  const diversityBonus = categoriesScanned.size === 3 ? 25 : 0;
  const ecoScore = baseScore + diversityBonus;
  const level = Math.floor(ecoScore / 50) + 1;
  const levelStart = (level - 1) * 50;
  const levelProgress = Math.min(
    100,
    Math.round(((ecoScore - levelStart) / 50) * 100)
  );
  const pointsToNextLevel = Math.max(0, level * 50 - ecoScore);

  const averageConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + Number(value), 0) /
        confidenceValues.length
      : null;

  const recentScans = history.slice(0, 5);

  const categoryRows = [
    {
      label: "Recyclable",
      count: recyclableCount,
      className: "bg-blue-500",
      icon: <Recycle size={18} />,
    },
    {
      label: "Organic",
      count: organicCount,
      className: "bg-emerald-500",
      icon: <Leaf size={18} />,
    },
    {
      label: "Hazardous",
      count: hazardousCount,
      className: "bg-amber-500",
      icon: <ShieldAlert size={18} />,
    },
  ];

  return (
    <section className="mx-auto max-w-6xl">
      {/* Dashboard heading */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
            <LayoutDashboard size={17} />
            Dashboard
          </div>

          <h2 className="mt-2 text-3xl font-black sm:text-4xl tracking-tight sm:text-5xl">
            Waste insights
          </h2>

          <p className="mt-3 max-w-2xl text-slate-500">
            Track your sorting activity, classification mix, AI confidence,
            and Eco-Sort progress in one place.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActivePage("scan")}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
        >
          <ScanLine size={18} />
          New Scan
        </button>
      </div>

      {/* Primary stats */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ScanLine size={21} />}
          title="Total Scans"
          value={totalScans}
          className="bg-emerald-50 text-emerald-600"
        />

        <StatCard
          icon={<Recycle size={21} />}
          title="Recyclable"
          value={recyclableCount}
          className="bg-blue-50 text-blue-600"
        />

        <StatCard
          icon={<Leaf size={21} />}
          title="Organic"
          value={organicCount}
          className="bg-emerald-50 text-emerald-600"
        />

        <StatCard
          icon={<ShieldAlert size={21} />}
          title="Hazardous"
          value={hazardousCount}
          className="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Eco Score hero */}
      <div className="mt-6 overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white">
                <Sparkles size={24} />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Eco-Sort Score
                </p>
                <h3 className="mt-1 text-2xl font-black">
                  Level {level} · {ecoScore} points
                </h3>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-300">
              Earn points by successfully classifying waste. Scan all three
              categories to unlock the diversity bonus.
            </p>

            {categoriesScanned.size === 3 ? (
              <p className="mt-3 text-sm font-bold text-emerald-400">
                All three categories scanned — +25 diversity bonus unlocked!
              </p>
            ) : (
              <p className="mt-3 text-sm font-bold text-slate-300">
                {3 - categoriesScanned.size}{" "}
                {3 - categoriesScanned.size === 1 ? "category" : "categories"}{" "}
                remaining for the diversity bonus.
              </p>
            )}
          </div>

          <div className="w-full max-w-sm shrink-0 rounded-2xl bg-white/10 p-5 backdrop-blur">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-slate-300">
                Progress to Level {level + 1}
              </span>
              <span className="font-black text-emerald-400">
                {levelProgress}%
              </span>
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${levelProgress}%` }}
              />
            </div>

            <p className="mt-3 text-xs font-medium text-slate-400">
              {pointsToNextLevel === 0
                ? "Ready for the next level!"
                : `${pointsToNextLevel} points to go`}
            </p>
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <BarChart3 size={22} />
            </div>

            <div>
              <h3 className="font-black">Classification overview</h3>
              <p className="text-sm text-slate-500">
                Distribution of your saved scans
              </p>
            </div>
          </div>

          {totalScans > 0 ? (
            <div className="mt-7 space-y-5">
              {categoryRows.map((row) => {
                const percentage = Math.round((row.count / totalScans) * 100);

                return (
                  <div key={row.label}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <span className="text-slate-500">{row.icon}</span>
                        {row.label}
                      </div>

                      <span className="text-sm font-black text-slate-500">
                        {row.count} · {percentage}%
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${row.className} transition-all duration-700`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-7 rounded-2xl bg-slate-50 p-8 text-center">
              <BarChart3 className="mx-auto text-slate-300" size={32} />
              <p className="mt-3 font-bold text-slate-600">
                No classification data yet
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Complete your first scan to see analytics here.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Sparkles size={22} />
            </div>

            <div>
              <h3 className="font-black">AI performance</h3>
              <p className="text-sm text-slate-500">
                Confidence from available results
              </p>
            </div>
          </div>

          <div className="mt-8">
            {averageConfidence !== null ? (
              <>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-3xl font-black sm:text-5xl text-emerald-600">
                      {Math.round(averageConfidence)}%
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Average confidence across your scans
                    </p>
                  </div>

                  <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                    {confidenceValues.length} results
                  </div>
                </div>

                <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{
                      width: `${Math.min(100, averageConfidence)}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="rounded-2xl bg-slate-50 p-8 text-center">
                <Sparkles className="mx-auto text-slate-300" size={32} />
                <p className="mt-3 font-bold text-slate-600">
                  Confidence data unavailable
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Once the backend returns confidence values, they will appear
                  here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Clock3 size={21} />
              </div>

              <div>
                <h3 className="font-black">Recent activity</h3>
                <p className="text-sm text-slate-500">
                  Your latest successful classifications
                </p>
              </div>
            </div>
          </div>

          {history.length > 5 && (
            <button
              type="button"
              onClick={() => setActivePage("history")}
              className="text-sm font-black text-emerald-600 transition hover:text-emerald-700"
            >
              View all
            </button>
          )}
        </div>

        {recentScans.length > 0 ? (
          <div className="mt-6 divide-y divide-slate-100">
            {recentScans.map((item) => (
              <RecentActivityRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-slate-50 p-8 text-center">
            <ScanLine className="mx-auto text-slate-300" size={32} />
            <p className="mt-3 font-bold text-slate-600">
              No recent activity
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Start scanning waste to build your dashboard.
            </p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-7 sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              Keep sorting smarter
            </p>

            <h3 className="mt-1 text-2xl font-black text-slate-900">
              Scan another waste item
            </h3>

            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
              Use AI classification to make better waste-separation decisions
              and grow your Eco-Sort Score.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActivePage("scan")}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700"
          >
            Start Scan
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}

function RecentActivityRow({ item }) {
  const label = item.label || "Unknown";
  const normalizedLabel = label.toLowerCase();

  const isHazardous = normalizedLabel.includes("hazard");
  const isOrganic = normalizedLabel.includes("organic");

  const icon = isHazardous ? (
    <ShieldAlert size={19} />
  ) : isOrganic ? (
    <Leaf size={19} />
  ) : (
    <Recycle size={19} />
  );

  const iconClass = isHazardous
    ? "bg-amber-50 text-amber-600"
    : isOrganic
      ? "bg-emerald-50 text-emerald-600"
      : "bg-blue-50 text-blue-600";

  return (
    <div className="flex items-center gap-3 py-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-slate-800">{label}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">
          {item.fileName} · {formatDate(item.timestamp)}
        </p>
      </div>

      {item.confidence !== null && item.confidence !== undefined && (
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold text-slate-400">Confidence</p>
          <p className="mt-0.5 font-black text-emerald-600">
            {Math.round(item.confidence)}%
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* REUSABLE COMPONENTS                                                        */
/* -------------------------------------------------------------------------- */

function NavButton({ active, icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "text-slate-600 hover:bg-slate-50 hover:text-emerald-600"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function MobileNavButton({ active, icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "text-slate-500"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function StatCard({ icon, title, value, className }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${className}`}
      >
        {icon}
      </div>

      <p className="mt-5 text-sm font-semibold text-slate-500">
        {title}
      </p>

      <p className="mt-1 text-3xl font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}

function ProgressRow({ label, count, total }) {
  const percentage =
    total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-bold text-slate-700">{label}</span>

        <span className="font-semibold text-slate-400">
          {count} · {percentage}%
        </span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

function Category({ icon, title, description, className }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${className}`}
      >
        {icon}
      </div>

      <h3 className="mt-5 text-lg font-black">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function formatDate(timestamp) {
  if (!timestamp) return "Unknown time";

  try {
    return new Date(timestamp).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "Unknown time";
  }
}

export default App;