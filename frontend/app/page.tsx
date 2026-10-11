'use client';

import React, { useState } from 'react';
import { createFeedbackSchema, CreateFeedbackInput } from '@/lib/validation';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';
import { Select } from '@/components/Select';
import { Button } from '@/components/Button';
import { Alert } from '@/components/Alert';

type FormErrors = Partial<Record<keyof CreateFeedbackInput, string>>;

export default function PublicFeedbackPage() {
  const [formData, setFormData] = useState<CreateFeedbackInput>({
    message: '',
    productName: '',
    userName: '',
    userEmail: '',
    source: 'web',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [attachmentMeta, setAttachmentMeta] = useState<{
    objectKey: string;
    originalName: string;
    contentType: string;
    sizeBytes: number;
  } | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploadingFile(true);

    // Create local object URL for instant preview
    const previewUrl = URL.createObjectURL(file);
    setAttachmentPreview(previewUrl);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: uploadFormData,
      });

      const resData = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(resData?.error?.message || 'Screenshot upload failed');
      }

      setAttachmentMeta(resData.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
      setAttachmentPreview(null);
      setAttachmentMeta(null);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleRemoveAttachment = () => {
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
    }
    setAttachmentPreview(null);
    setAttachmentMeta(null);
    setUploadError(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev: CreateFeedbackInput) => ({ ...prev, [name]: value }));

    // Clear field error on edit
    if (errors[name as keyof CreateFeedbackInput]) {
      setErrors((prev: FormErrors) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitStatus(null);

    // Validate form inputs client-side
    const result = createFeedbackSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.issues.forEach((issue: { path: (string | number)[]; message: string }) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as keyof CreateFeedbackInput] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const submitPayload = {
        ...result.data,
        ...(attachmentMeta
          ? {
              attachmentKey: attachmentMeta.objectKey,
              attachmentName: attachmentMeta.originalName,
              attachmentType: attachmentMeta.contentType,
              attachmentSize: attachmentMeta.sizeBytes,
            }
          : {}),
      };

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitPayload),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const errorBody = payload as {
          error?: {
            message?: string;
            details?: Array<{ field?: string; message?: string }>;
          };
        } | null;

        const fieldErrors: FormErrors = {};
        const details = errorBody?.error?.details;
        if (Array.isArray(details)) {
          details.forEach((detail) => {
            if (
              detail.field &&
              (detail.field === 'message' ||
                detail.field === 'productName' ||
                detail.field === 'userName' ||
                detail.field === 'userEmail' ||
                detail.field === 'source')
            ) {
              fieldErrors[detail.field] = detail.message ?? 'Invalid value';
            }
          });
        }
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
        }

        throw new Error(errorBody?.error?.message ?? `Request failed with status ${response.status}`);
      }

      // Intentionally minimal success message: do not expose internal
      // analysis labels or the record ID to the public submitter.
      setSubmitStatus({
        type: 'success',
        message: 'Thanks, your feedback was received.',
      });
      setFormData({
        message: '',
        productName: '',
        userName: '',
        userEmail: '',
        source: 'web',
      });
      handleRemoveAttachment();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to submit feedback. Please try again.';
      setSubmitStatus({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const charCount = formData.message.length;
  const isCharCountValid = charCount >= 10 && charCount <= 2000;

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            FeedbackIQ Platform
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Share Your Feedback
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto">
            Help us improve by telling us what you think. Your input powers our AI analytics!
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          {submitStatus && (
            <Alert variant={submitStatus.type}>
              {submitStatus.message}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Feedback Message Field */}
            <FormField
              id="message"
              label="Feedback Message"
              required
              error={errors.message}
              hint="Be as detailed as possible (10 to 2000 characters)"
            >
              {(fieldProps) => (
                <div className="space-y-1">
                  <Textarea
                    {...fieldProps}
                    name="message"
                    rows={4}
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Tell us what you liked, what went wrong, or what feature you need..."
                  />
                  <div className="flex justify-end">
                    <span
                      className={`text-xs font-mono ${
                        charCount > 2000
                          ? 'text-rose-400 font-bold'
                          : charCount > 0 && charCount < 10
                          ? 'text-amber-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {charCount} / 2000
                    </span>
                  </div>
                </div>
              )}
            </FormField>

            {/* Product Name Field */}
            <FormField
              id="productName"
              label="Product or Service Name"
              required
              error={errors.productName}
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="text"
                  name="productName"
                  value={formData.productName}
                  onChange={handleInputChange}
                  placeholder="e.g. Mobile App, Checkout Page, Customer Support"
                />
              )}
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* User Name Field */}
              <FormField id="userName" label="Your Name" error={errors.userName}>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    type="text"
                    name="userName"
                    value={formData.userName}
                    onChange={handleInputChange}
                    placeholder="Optional"
                  />
                )}
              </FormField>

              {/* User Email Field */}
              <FormField id="userEmail" label="Email Address" error={errors.userEmail}>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    type="email"
                    name="userEmail"
                    value={formData.userEmail}
                    onChange={handleInputChange}
                    placeholder="name@example.com (Optional)"
                  />
                )}
              </FormField>
            </div>

            {/* Feedback Source Select */}
            <FormField id="source" label="Feedback Source" error={errors.source}>
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  name="source"
                  value={formData.source}
                  onChange={handleInputChange}
                >
                  <option value="web">Web Application</option>
                  <option value="email">Email</option>
                  <option value="survey">User Survey</option>
                  <option value="support">Customer Support</option>
                  <option value="other">Other</option>
                </Select>
              )}
            </FormField>

            {/* Optional Screenshot Attachment Upload */}
            <div className="space-y-2">
              <label htmlFor="screenshot-upload" className="block text-sm font-medium text-slate-300">
                Attach Screenshot <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <p className="text-xs text-slate-400">
                Allowed formats: PNG, JPEG, WebP. Max size: 5 MB.
              </p>

              {attachmentPreview ? (
                <div className="relative inline-block border border-slate-700 rounded-xl p-2 bg-slate-800/80">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachmentPreview}
                    alt="Screenshot preview"
                    className="max-h-40 rounded-lg object-contain"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                    <span className="truncate max-w-[200px]">{attachmentMeta?.originalName}</span>
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="ml-2 text-rose-400 hover:text-rose-300 font-medium underline focus:outline-none focus:ring-2 focus:ring-rose-400 rounded px-1"
                      aria-label="Remove attached screenshot"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    id="screenshot-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileSelect}
                    disabled={isUploadingFile}
                    aria-label="Upload screenshot"
                    className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600/30 file:text-indigo-300 hover:file:bg-indigo-600/50 cursor-pointer focus:outline-none"
                  />
                  {isUploadingFile && (
                    <p className="text-xs text-indigo-400 mt-1 animate-pulse">Uploading screenshot...</p>
                  )}
                  {uploadError && <p className="text-xs text-rose-400 mt-1">{uploadError}</p>}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                disabled={isUploadingFile}
                className="w-full py-3 text-base font-semibold"
              >
                Submit Feedback
              </Button>
            </div>
          </form>
        </div>

        {/* Footer Link */}
        <div className="text-center text-xs text-slate-500">
          Admin Portal available in Phase 5 •{' '}
          <a href="/admin" className="text-indigo-400 hover:underline">
            Go to Admin Placeholder
          </a>
        </div>
      </div>
    </main>
  );
}
