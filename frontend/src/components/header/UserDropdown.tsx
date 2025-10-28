import { useState } from "react";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { PlusIcon } from "../../icons";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useFormik, FieldArray, FormikProvider, FormikHelpers } from "formik";
import * as Yup from "yup";

interface TelemetryData {
  deviceId: string;
  timestamp: string;
  reading: number | string;
  unit: string;
  location: string;
  deviceType: string;
}

interface FormValues {
  data: TelemetryData[];
}

export default function UserDropdown() {
  const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;
  const CREATE_INGEST_API_URL =
    BACKEND_BASE_URL + import.meta.env.VITE_CREATE_INGEST_API_PATH;

  const [isDOpen, setIsDOpen] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();

  const toggleDropdown = () => setIsDOpen(!isDOpen);
  const closeDropdown = () => setIsDOpen(false);

  const toLocalDatetimeInput = (d = new Date()): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`; // e.g. "2025-10-28T07:30"
  };

  const handleCloseModal = () => {
    formik.resetForm({
      values: {
        data: [
          {
            deviceId: "",
            timestamp: toLocalDatetimeInput(),
            reading: "",
            unit: "W",
            location: "",
            deviceType: "",
          },
        ],
      },
      status: undefined, // clear success/error messages
    });
    formik.setStatus(undefined);
    closeModal();
  };

  // ✅ Yup Validation Schema
  const validationSchema = Yup.object().shape({
    data: Yup.array()
      .of(
        Yup.object().shape({
          deviceId: Yup.string()
            .matches(
              /^[a-zA-Z0-9-]+$/,
              "Device ID must use '-' instead of spaces"
            )
            .required("Device ID is required"),
          timestamp: Yup.date()
            .max(new Date(), "Timestamp cannot be in the future")
            .required("Timestamp is required"),
          reading: Yup.number()
            .typeError("Reading must be a number")
            .min(0, "Reading cannot be negative") // ✅ Added this
            .required("Reading is required"),

          location: Yup.string().required("Location is required"),
          deviceType: Yup.string().required("Device type is required"),
        })
      )
      .min(1, "At least one record is required"),
  });

  // ✅ Formik Setup
  const formik = useFormik<FormValues>({
    initialValues: {
      data: [
        {
          deviceId: "",
          timestamp: toLocalDatetimeInput(),
          reading: "",
          unit: "W",
          location: "",
          deviceType: "smart_plug",
        },
      ],
    },
    validationSchema,
    validateOnChange: false,
    validateOnBlur: true,
    onSubmit: async (
      values,
      { setSubmitting, resetForm, setStatus }: FormikHelpers<FormValues>
    ) => {
      try {
        const res = await fetch(CREATE_INGEST_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values.data),
        });

        const data = await res.json();

        if (!res.ok) {
          // Backend returned an error
          let detailedErrors = "";
          if (data.errors && Array.isArray(data.errors)) {
            detailedErrors = data.errors
              .map((e: any) => `Item ${e.index + 1}: ${e.error}`)
              .join("; ");
          }

          setStatus({
            type: "error",
            message: detailedErrors
              ? `${data.message}: ${detailedErrors}`
              : data.message || "Failed to send data",
          });
          return;
        }

        // Success
        setStatus({
          type: "success",
          message: `${data.message} (${data.count} readings saved)`,
        });

        // Optionally reset the form after showing success
        resetForm({
          values: { data: [] },
          status: {
            type: "success",
            message: `${data.message} (${data.count} readings saved)`,
          },
        });

        // Close modal after 1.5s so user can see message
        setTimeout(() => closeModal(), 2500);
      } catch (err: unknown) {
        // TypeScript-safe catch
        const errorMessage =
          err instanceof Error ? err.message : "Something went wrong";

        setStatus({ type: "error", message: errorMessage });
      } finally {
        setSubmitting(false);
      }
    },
  });

  const {
    values,
    handleChange,
    handleBlur,
    handleSubmit,
    isSubmitting,
    errors,
    touched,
  } = formik;

  return (
    <>
      <div className="relative">
        {/* Dropdown Trigger */}
        <button
          onClick={toggleDropdown}
          className="flex items-center text-gray-700 dropdown-toggle dark:text-gray-400"
        >
          <span className="mr-3 overflow-hidden rounded-full h-11 w-11">
            <img src="/images/user/owner.jpg" alt="User" />
          </span>
          <span className="block mr-1 font-medium text-theme-sm">Ruchira</span>
          <svg
            className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${
              isDOpen ? "rotate-180" : ""
            }`}
            width="18"
            height="20"
            viewBox="0 0 18 20"
          >
            <path
              d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Dropdown Content */}
        <Dropdown
          isOpen={isDOpen}
          onClose={closeDropdown}
          className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
        >
          <div>
            <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400">
              Ruchira Kavinda
            </span>
            <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
              ruchirakvnd@gmail.com
            </span>
          </div>

          <ul className="flex flex-col gap-1 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
            <li>
              <DropdownItem
                onItemClick={openModal}
                className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                <PlusIcon />
                Add Telemetry Data
              </DropdownItem>
            </li>
          </ul>
        </Dropdown>
      </div>

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        className="max-w-[800px] m-4 bg-transparent"
      >
        <div className="relative w-full max-h-[90vh] p-4 overflow-y-auto bg-white no-scrollbar rounded-3xl dark:bg-gray-900 lg:p-10">
          <h4 className="mb-3 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Create Telemetry Data
          </h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Add one or more telemetry records for your devices.
          </p>

          {formik.status?.message && (
            <div
              className={`mb-4 px-4 py-2 rounded-md text-sm ${
                formik.status.type === "success"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
              }`}
            >
              {formik.status.message}
            </div>
          )}

          <FormikProvider value={formik}>
            <form onSubmit={handleSubmit} className="flex flex-col">
              <FieldArray
                name="data"
                render={({
                  push,
                  remove,
                }: {
                  push: (obj: TelemetryData) => void;
                  remove: (index: number) => void;
                }) => (
                  <div className="flex flex-col gap-6">
                    {values.data.map((item, index) => (
                      <div
                        key={index}
                        className="p-4 border rounded-2xl border-gray-200 dark:border-gray-700"
                      >
                        <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
                          {/* Device ID */}
                          <div>
                            <Label>Device ID</Label>
                            <Input
                              name={`data.${index}.deviceId`}
                              value={item.deviceId}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              placeholder="e.g., plug-kitchen-1"
                            />
                            {touched.data?.[index]?.deviceId &&
                              (errors.data?.[index] as any)?.deviceId && (
                                <p className="text-red-500 text-sm mt-1">
                                  {(errors.data?.[index] as any)?.deviceId}
                                </p>
                              )}
                          </div>

                          {/* Timestamp */}
                          <div>
                            <Label>Timestamp</Label>
                            <Input
                              type="datetime-local"
                              name={`data.${index}.timestamp`}
                              // ✅ Keep it local — no UTC conversion
                              value={item.timestamp.slice(0, 16)}
                              onChange={(e) =>
                                handleChange({
                                  target: {
                                    name: `data.${index}.timestamp`,
                                    value: e.target.value, // keep as local time string
                                  },
                                })
                              }
                              onBlur={handleBlur}
                            />
                            {touched.data?.[index]?.timestamp &&
                              (errors.data?.[index] as any)?.timestamp && (
                                <p className="text-red-500 text-sm mt-1">
                                  {(errors.data?.[index] as any)?.timestamp}
                                </p>
                              )}
                          </div>

                          {/* Reading */}
                          <div>
                            <Label>Reading</Label>
                            <Input
                              type="number"
                              name={`data.${index}.reading`}
                              value={item.reading}
                              onChange={handleChange}
                              onBlur={handleBlur}
                            />
                            {touched.data?.[index]?.reading &&
                              (errors.data?.[index] as any)?.reading && (
                                <p className="text-red-500 text-sm mt-1">
                                  {(errors.data?.[index] as any)?.reading}
                                </p>
                              )}
                          </div>

                          {/* Location */}
                          <div>
                            <Label>Location</Label>
                            <Input
                              name={`data.${index}.location`}
                              value={item.location}
                              onChange={handleChange}
                              onBlur={handleBlur}
                            />
                            {touched.data?.[index]?.location &&
                              (errors.data?.[index] as any)?.location && (
                                <p className="text-red-500 text-sm mt-1">
                                  {(errors.data?.[index] as any)?.location}
                                </p>
                              )}
                          </div>

                          {/* Device Type */}
                          <div>
                            <Label>Device Type</Label>
                            <Input
                              name={`data.${index}.deviceType`}
                              value={item.deviceType}
                              onChange={handleChange}
                              onBlur={handleBlur}
                            />
                            {touched.data?.[index]?.deviceType &&
                              (errors.data?.[index] as any)?.deviceType && (
                                <p className="text-red-500 text-sm mt-1">
                                  {(errors.data?.[index] as any)?.deviceType}
                                </p>
                              )}
                          </div>
                        </div>

                        {values.data.length > 1 && (
                          <div className="flex justify-end mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => remove(index)}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={() =>
                        push({
                          deviceId: "",
                          timestamp: toLocalDatetimeInput(),
                          reading: "",
                          unit: "W",
                          location: "",
                          deviceType: "",
                        })
                      }
                    >
                      + Add Another
                    </Button>
                  </div>
                )}
              />

              <div className="flex items-center gap-3 mt-8 lg:justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    formik.resetForm();
                    handleCloseModal();
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </form>
          </FormikProvider>
        </div>
      </Modal>
    </>
  );
}
