import { useState } from "react";
import {
  Leaf,
  Recycle,
  ShieldAlert,
  Camera,
  Upload,
  X,
  CheckCircle2,
} from "lucide-react";

function App() {
  const [selectedImage, setSelectedImage] = useState(null);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const imageUrl = URL.createObjectURL(file);

    setSelectedImage({
      file,
      url: imageUrl,
      name: file.name,
    });

    console.log("Selected image:", file);
  };

  const removeImage = () => {
    if (selectedImage?.url) {
      URL.revokeObjectURL(selectedImage.url);
    }

    setSelectedImage(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <Leaf size={24} />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight">
                ECO-SORT AI
              </h1>

              <p className="text-xs text-slate-500">
                See Waste. Know Waste. Sort Right.
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <button className="transition hover:text-emerald-600">
              Scan
            </button>

            <button className="transition hover:text-emerald-600">
              History
            </button>

            <button className="transition hover:text-emerald-600">
              Dashboard
            </button>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Hero */}
        <section className="text-center">
          <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
            <Recycle size={17} />
            AI-Powered Waste Classification
          </div>

          <h2 className="mx-auto max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
            Turn every piece of waste into the{" "}
            <span className="text-emerald-600">right decision.</span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Upload an image and ECO-SORT AI identifies whether your waste is
            recyclable, organic, or hazardous.
          </p>
        </section>

        {/* Upload Card */}
        <section className="mx-auto mt-12 max-w-3xl">
          <div className="rounded-3xl border-2 border-dashed border-emerald-200 bg-white p-8 shadow-xl shadow-emerald-100/50 sm:p-12">
            {!selectedImage ? (
              <>
                {/* Upload Icon */}
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
                  <Upload size={34} />
                </div>

                <div className="mt-6 text-center">
                  <h3 className="text-2xl font-bold">
                    Upload waste image
                  </h3>

                  <p className="mt-2 text-slate-500">
                    JPG, PNG or WEBP · Get an AI classification in seconds
                  </p>
                </div>

                {/* Buttons */}
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700">
                    <Upload size={19} />
                    Choose Image

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>

                  <button className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50">
                    <Camera size={19} />
                    Use Camera
                  </button>
                </div>
              </>
            ) : (
              /* Image Preview */
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">
                      Image selected
                    </h3>

                    <p className="mt-1 max-w-xs truncate text-sm text-slate-500">
                      {selectedImage.name}
                    </p>
                  </div>

                  <button
                    onClick={removeImage}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Remove image"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-slate-100">
                  <img
                    src={selectedImage.url}
                    alt="Selected waste"
                    className="max-h-96 w-full object-contain"
                  />
                </div>

                <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 size={18} />
                  Image ready for AI classification
                </div>

                <div className="mt-5 flex justify-center">
                  <button className="flex items-center gap-2 rounded-xl bg-slate-900 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-slate-800">
                    <Recycle size={19} />
                    Classify Waste
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Categories */}
        <section className="mt-16">
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
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-slate-500">
          ECO-SORT AI · Smart waste classification for a cleaner future.
        </div>
      </footer>
    </div>
  );
}

function Category({ icon, title, description, className }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${className}`}
      >
        {icon}
      </div>

      <h3 className="mt-5 text-lg font-bold">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default App;