import { getClassificationsTree } from "@/src/api/classifications";
import { getWorkflows } from "@/src/api/workflow";
import { convertToRequest, executeTransition, getIncidents, uploadAttachment } from "@/src/api/incidents";
import { validateImage } from "@/src/api/images";
import * as DocumentPicker from "expo-document-picker";
import { CustomAlert } from "@/src/components/CustomAlert";
import TreeSelect, { TreeNode } from "@/src/components/TreeSelect";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import i18n from "@/src/i18n";

// When true, an image attachment must pass server-side validation
// (POST /images/validate) before a transition can be executed. Mirrors the
// same gate in add-incident.tsx / update-status.tsx.
const IMAGE_VALIDATION_REQUIRED =
  process.env.EXPO_PUBLIC_IMAGE_VALIDATION_REQUIRED === "true";

const COLORS = {
  primary: "#1A237E",
  accent: "#2EC4B6",
  background: "#F5F7FA",
  white: "#FFFFFF",
  text: {
    primary: "#1A1A2E",
    secondary: "#64748B",
    muted: "#94A3B8",
  },
  border: "#E2E8F0",
  error: "#DC2626",
};

export default function ConvertToRequestScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id, transitions, incident } = useLocalSearchParams();
  const incidentId = Array.isArray(id) ? id[0] : id;

  const incidentVersion = useMemo(() => {
    try {
      const incidentStr = Array.isArray(incident) ? incident[0] : incident;
      const parsed = incidentStr ? JSON.parse(incidentStr as string) : null;
      return parsed?.version || 1;
    } catch (error) {
      return 1;
    }
  }, [incident]);

  const [loading, setLoading] = useState(false);

  // Data
  const [classifications, setClassifications] = useState<TreeNode[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);

  // Wizard State
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Step 1: Transition
  const [convertType, setConvertType] = useState<"new" | "existing">("new");

  // -- For existing
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedRequests, setSearchedRequests] = useState<any[]>([]);
  const [searchingRequests, setSearchingRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [convertableRequestId, setConvertableRequestId] = useState<string>('');

  // -- For new
  const [transitionId, setTransitionId] = useState<string | null>("");
  const [selectedTransitionObj, setSelectedTransitionObj] = useState<any>(null);
  const [transitionComment, setTransitionComment] = useState("");

  // Dynamic requirements
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [transitionAttachment, setTransitionAttachment] = useState<DocumentPicker.DocumentPickerResult | null>(null);

  const [showTransitionPicker, setShowTransitionPicker] = useState(false);

  // Step 2: Classification
  const [classificationId, setClassificationId] = useState("");

  // Step 3: Workflow
  const [workflowId, setWorkflowId] = useState("");
  const [showWorkflowPicker, setShowWorkflowPicker] = useState(false);

  const availableTransitions = useMemo(() => {
    try {
      return transitions ? JSON.parse(transitions as string) : [];
    } catch (error) {
      return [];
    }
  }, [transitions]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (convertType !== "existing") return;
    const delayDebounceFn = setTimeout(() => {
      searchExistingRequests(searchQuery);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, convertType]);

  const fetchData = async () => {
    try {
      const [classResRequest, classResBoth] = await Promise.all([
        getClassificationsTree("request"),
        getClassificationsTree("both")
      ]);

      let combined: any[] = [];
      if (classResRequest.success) combined = [...combined, ...classResRequest.data];
      if (classResBoth.success) combined = [...combined, ...classResBoth.data];

      const uniqueClassifications = Array.from(new Map(combined.map(item => [item.id, item])).values());
      setClassifications(uniqueClassifications as TreeNode[]);

      const wfRes = await getWorkflows(true, "request");
      if (wfRes.success) {
        const fetchedWorkflows = wfRes.data || [];
        setWorkflows(fetchedWorkflows);
        if (fetchedWorkflows.length === 1) {
          const convertableRequestState = fetchedWorkflows[0].states.find((x: any) => x.state_type === 'initial')?.id || '';
          setConvertableRequestId(convertableRequestState);
          setWorkflowId(fetchedWorkflows[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch convert data", err);
    }
  };

  const searchExistingRequests = async (query: string) => {
    setSearchingRequests(true);
    try {
      const params: Record<string, any> = { record_type: 'request', limit: 15, current_state_id: convertableRequestId };
      if (query) params.search = query;
      const res = await getIncidents(params);
      if (res.success && res.data) {
        setSearchedRequests(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingRequests(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setTransitionAttachment(result);
      }
    } catch (err) {
      console.error("Failed to pick document", err);
    }
  };

  const handleRemoveDocument = () => {
    setTransitionAttachment(null);
  };

  const handleNext = () => {
    if (currentStepIndex === 0) {
      if (convertType === "existing" && !selectedRequest) {
        CustomAlert.alert(t("common.error"), t("incidents.pleaseSelectRequest"));
        return;
      }

      if (convertType === "new" && selectedTransitionObj && selectedTransitionObj.requirements) {
        // Validate requirements
        const isAttachmentRequired = selectedTransitionObj.requirements.some((r: any) => r.requirement_type === "attachment" && r.is_mandatory);
        const isFeedbackRequired = selectedTransitionObj.requirements.some((r: any) => r.requirement_type === "feedback" && r.is_mandatory);
        const isCommentRequired = selectedTransitionObj.requirements.some((r: any) => r.requirement_type === "comment" && r.is_mandatory);

        if (isAttachmentRequired && (!transitionAttachment || !transitionAttachment.assets)) {
          CustomAlert.alert(t("common.error"), t("incidents.attachmentRequired", "Attachment is required"));
          return;
        }
        if (isFeedbackRequired && (!feedbackRating || !feedbackComment.trim())) {
          CustomAlert.alert(t("common.error"), t("incidents.feedbackRequired", "Feedback rating and comment are required"));
          return;
        }
        if (isCommentRequired && !transitionComment.trim()) {
          CustomAlert.alert(t("common.error"), t("incidents.commentRequired", "Comment is required"));
          return;
        }
      }

      setCurrentStepIndex(1);
    } else if (currentStepIndex === 1) {
      // If they chose an existing request, and it already has a classification, we could pre-fill it.
      // But let's just validate.
      if (!classificationId && (!selectedRequest || !selectedRequest.classification_id)) {
        CustomAlert.alert(t("common.error"), t("incidents.pleaseSelectClassification"));
        return;
      }
      setCurrentStepIndex(2);
    } else if (currentStepIndex === 2) {
      if (!workflowId && (!selectedRequest || !selectedRequest.workflow_id)) {
        CustomAlert.alert(t("common.error"), t("incidents.pleaseSelectWorkflow"));
        return;
      }
      setCurrentStepIndex(3);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!feedbackComment.trim()) {
      CustomAlert.alert(
        t("common.error"),
        t("incidents.feedbackMandatoryError", "Feedback comment is required to submit.")
      );
      return;
    }

    setLoading(true);
    try {
      // 1. If a real transition was selected, execute it via the dedicated transition
      // endpoint first (it correctly enforces optimistic locking via `version`).
      // The convert-to-request endpoint is then called without transition_id so it
      // only handles the classification/workflow/request-creation part.
      if (convertType === "new" && transitionId) {
        let attachmentIds: string[] | undefined;
        if (transitionAttachment && transitionAttachment.assets) {
          const file = transitionAttachment.assets[0];
          const fileToUpload: any = {
            uri: file.uri,
            type: file.mimeType || 'application/octet-stream',
            name: file.name,
          };

          if (IMAGE_VALIDATION_REQUIRED && fileToUpload.type?.startsWith("image/")) {
            const result = await validateImage(fileToUpload);
            if (!result.valid) {
              setTransitionAttachment(null);
              setLoading(false);
              CustomAlert.alert(
                t("addIncident.invalidImageTitle"),
                result.message || t("addIncident.invalidImageMessage")
              );
              return;
            }
          }

          const uploadRes = await uploadAttachment(incidentId, fileToUpload);
          if (!uploadRes.success) {
            CustomAlert.alert(t("common.error"), t("incidents.uploadFailed"));
            setLoading(false);
            return;
          }
          if (uploadRes.data?.id) {
            attachmentIds = [uploadRes.data.id];
          }
        }

        const transitionRes = await executeTransition(incidentId, {
          transition_id: transitionId,
          comment: transitionComment || undefined,
          attachments: attachmentIds,
          feedback: feedbackRating || feedbackComment.trim()
            ? { rating: feedbackRating || 0, comment: feedbackComment || "" }
            : undefined,
          version: incidentVersion,
        });

        if (!transitionRes.success) {
          const errorMessage = transitionRes.error || "";
          if (errorMessage.includes("conflict") || errorMessage.includes("modified by another user")) {
            CustomAlert.alert(
              t("common.conflictDetected", "Conflict Detected"),
              t("common.incidentModifiedByAnother", "This incident was modified by another user. Please review and try again.")
            );
          } else {
            CustomAlert.alert(t("common.error"), errorMessage || t("errors.unknownError"));
          }
          setLoading(false);
          return;
        }
      }

      // 2. Build convert payload
      const payload: any = {
        classification_id: selectedRequest?.classification?.id || classificationId,
        workflow_id: selectedRequest?.workflow?.id || workflowId,
      };

      if (convertType === "existing" && selectedRequest) {
        payload.existing_request_id = selectedRequest.id;
      }

      // Feedback is mandatory for every conversion (new or existing) — matches web behavior
      payload.feedback = {
        rating: feedbackRating || 0,
        comment: feedbackComment.trim(),
      };

      const response = await convertToRequest(incidentId, payload);

      if (response.success) {
        CustomAlert.alert(
          t("common.success"),
          t("incidents.convertedSuccessfully"),
          [{ text: t("common.ok"), onPress: () => router.back() }]
        );
      } else {
        CustomAlert.alert(t("common.error"), response.error || t("errors.unknownError"));
      }
    } catch (err: any) {
      CustomAlert.alert(t("common.error"), err.message || t("errors.unknownError"));
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = [1, 2, 3, 4];
    return (
      <View style={styles.stepIndicatorContainer}>
        {steps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;

          return (
            <React.Fragment key={index}>
              <View style={[styles.stepCircle, isActive && styles.stepCircleActive, isCompleted && styles.stepCircleCompleted]}>
                {isCompleted ? (
                  <Ionicons name="checkmark" size={16} color={COLORS.white} />
                ) : (
                  <Text style={[styles.stepNumber, isActive && styles.stepNumberActive]}>{step}</Text>
                )}
              </View>
              {index < steps.length - 1 && (
                <View style={[styles.stepLine, isCompleted && styles.stepLineCompleted]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t("requests.transition")}</Text>

      {/* Type Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, convertType === "new" && styles.toggleButtonActive]}
          onPress={() => setConvertType("new")}
        >
          <Text style={[styles.toggleButtonText, convertType === "new" && styles.toggleButtonTextActive]}>
            {t("requests.newRequest")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, convertType === "existing" && styles.toggleButtonActive]}
          onPress={() => setConvertType("existing")}
        >
          <Text style={[styles.toggleButtonText, convertType === "existing" && styles.toggleButtonTextActive]}>
            {t("requests.existingRequest")}
          </Text>
        </TouchableOpacity>
      </View>

      {convertType === "existing" ? (
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t("requests.searchRequest")} *</Text>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={COLORS.text.muted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
              placeholder={t("requests.searchRequestPlaceholder")}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {searchingRequests && <ActivityIndicator style={{ marginTop: 10 }} color={COLORS.accent} />}

          {!searchingRequests && !searchQuery && searchedRequests.length > 0 && (
            <Text style={styles.searchHint}>{t("requests.searchRequestHint")}</Text>
          )}

          {!searchingRequests && searchedRequests.length > 0 && (
            <View style={styles.searchResults}>
              {searchedRequests.map((req) => (
                <TouchableOpacity
                  key={req.id}
                  style={[styles.resultItem, selectedRequest?.id === req.id && styles.resultItemSelected]}
                  onPress={() => {
                    setSelectedRequest(req);
                    // Pre-fill classification/workflow if available
                    if (req.classification?.id) setClassificationId(req.classification.id);
                    if (req.workflow?.id) setWorkflowId(req.workflow.id);
                  }}
                >
                  <Text style={[styles.resultItemTitle, selectedRequest?.id === req.id && styles.resultItemTextSelected]}>
                    {req.incident_number}
                  </Text>
                  <Text style={styles.resultItemDesc} numberOfLines={1}>{req.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!searchingRequests && searchQuery && searchedRequests.length === 0 && (
            <Text style={styles.noResultsText}>{t("common.noResults", "No Results")}</Text>
          )}
        </View>
      ) : (
        <>
          {availableTransitions.length > 0 ? (
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t("incidents.optionalTransition")}</Text>
              <TouchableOpacity style={styles.selector} onPress={() => setShowTransitionPicker(true)}>
                <Text style={[styles.selectorText, transitionId === null && styles.placeholderText]}>
                  {transitionId
                    ? availableTransitions.find((t: any) => t.transition.id === transitionId)?.transition?.name || transitionId
                    : transitionId === "" ? t("incidents.skipTransition") : t("incidents.selectTransition")}
                </Text>
                <Ionicons name="chevron-down" size={20} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.noResultsText}>
              {t("incidents.noTransitionsAvailable", "No transitions available. You can proceed to the next step.")}
            </Text>
          )}

          {/* Dynamic Requirements */}
          {selectedTransitionObj && selectedTransitionObj.requirements && selectedTransitionObj.requirements.length > 0 && (
            <View style={styles.requirementsContainer}>

              {/* Feedback */}
              {selectedTransitionObj.requirements.some((r: any) => r.requirement_type === "feedback") && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {t("incidents.feedback")}
                    {selectedTransitionObj.requirements.some((r: any) => r.requirement_type === "feedback" && r.is_mandatory) && " *"}
                  </Text>
                  <View style={styles.feedbackContainer}>
                    <Text style={styles.feedbackHint}>{t("incidents.rateExperience")}</Text>
                    <View style={styles.starsContainer}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star} onPress={() => setFeedbackRating(star)}>
                          <Ionicons
                            name={star <= feedbackRating ? "star" : "star-outline"}
                            size={32}
                            color={star <= feedbackRating ? "#FBBF24" : COLORS.text.muted}
                          />
                        </TouchableOpacity>
                      ))}
                      {feedbackRating > 0 && <Text style={styles.feedbackRatingText}>{feedbackRating}/5</Text>}
                    </View>
                    <TextInput
                      style={[styles.textArea, { marginTop: 12, minHeight: 80 }]}
                      multiline
                      numberOfLines={3}
                      placeholder={t("incidents.feedbackCommentPlaceholder")}
                      value={feedbackComment}
                      onChangeText={setFeedbackComment}
                    />
                  </View>
                </View>
              )}

              {/* Attachment */}
              {selectedTransitionObj.requirements.some((r: any) => r.requirement_type === "attachment") && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {t("incidents.attachment")}
                    {selectedTransitionObj.requirements.some((r: any) => r.requirement_type === "attachment" && r.is_mandatory) && " *"}
                  </Text>
                  {transitionAttachment && transitionAttachment.assets ? (
                    <View style={styles.attachmentCard}>
                      <View style={styles.attachmentInfo}>
                        <Ionicons name="document-text" size={24} color={COLORS.text.secondary} />
                        <Text style={styles.attachmentName} numberOfLines={1}>
                          {transitionAttachment.assets[0].name}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={handleRemoveDocument} style={styles.removeAttachmentButton}>
                        <Ionicons name="close" size={20} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.uploadButton} onPress={handlePickDocument}>
                      <Ionicons name="cloud-upload-outline" size={24} color={COLORS.text.secondary} />
                      <Text style={styles.uploadButtonText}>{t("incidents.clickToUpload")}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Comment */}
              {selectedTransitionObj.requirements.some((r: any) => r.requirement_type === "comment") && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {t("incidents.comment", "Comment")}
                    {selectedTransitionObj.requirements.some((r: any) => r.requirement_type === "comment" && r.is_mandatory) && " *"}
                  </Text>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    numberOfLines={4}
                    placeholder={t("incidents.addCommentForTransition")}
                    value={transitionComment}
                    onChangeText={setTransitionComment}
                  />
                </View>
              )}

            </View>
          )}
        </>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t("details.classification", "Classification")}</Text>

      {convertType === "existing" && selectedRequest?.classification ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardLabel}>{t("details.classification", "Classification")}</Text>
          <Text style={styles.infoCardValue}>{selectedRequest.classification.name}</Text>
          <Text style={styles.infoCardHelp}>{t("requests.inheritedFromExisting", "Inherited from existing request")}</Text>
        </View>
      ) : (
        <View style={styles.formGroup}>
          <TreeSelect
            label={t("details.classification")}
            value={classificationId
              ? (classifications as any).find((c: any) => c.id === classificationId)?.name || classificationId
              : ""}
            valueId={classificationId}
            data={classifications}
            onSelect={(node) => setClassificationId(node?.id || "")}
          />
        </View>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t("common.workflow", "Workflow")}</Text>

      {convertType === "existing" && selectedRequest?.workflow ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardLabel}>{t("common.workflow", "Workflow")}</Text>
          <Text style={styles.infoCardValue}>{selectedRequest.workflow.name}</Text>
          <Text style={styles.infoCardHelp}>{t("requests.inheritedFromExisting", "Inherited from existing request")}</Text>
        </View>
      ) : (
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t("common.workflow")} *</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setShowWorkflowPicker(true)}>
            <Text style={[styles.selectorText, !workflowId && styles.placeholderText]}>
              {workflowId
                ? workflows.find(w => w.id === workflowId)?.name || workflowId
                : t("incidents.selectWorkflow")}
            </Text>
            <Ionicons name="chevron-down" size={20} color={COLORS.text.secondary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Recursive helper to find a classification name in a nested tree
  const findClassificationName = (nodes: any[], id: string): string | null => {
    for (const node of nodes) {
      if (node.id === id) return node.name;
      if (node.children?.length) {
        const found = findClassificationName(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const renderStep4 = () => {
    const classificationName = convertType === "existing" && selectedRequest?.classification
      ? selectedRequest.classification.name
      : findClassificationName(classifications as any[], classificationId) || classificationId || t("common.na");

    const workflowName = convertType === "existing" && selectedRequest?.workflow
      ? selectedRequest.workflow.name
      : workflows.find(w => w.id === workflowId)?.name || workflowId || t("common.na");

    const transitionName = transitionId
      ? availableTransitions.find((t: any) => t.transition.id === transitionId)?.transition?.name || transitionId
      : transitionId === "" ? t("incidents.skipTransition") : t("incidents.none");

    const hasFeedbackRequirement = selectedTransitionObj?.requirements?.some(
      (r: any) => r.requirement_type === "feedback"
    );
    const hasCommentRequirement = selectedTransitionObj?.requirements?.some(
      (r: any) => r.requirement_type === "comment"
    );

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{t("requests.review")}</Text>

        <View style={styles.summaryCard}>
          {/* Type */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("requests.type")}</Text>
            <Text style={styles.summaryValue}>
              {convertType === "existing" ? t("requests.existingRequest") : t("requests.newRequest")}
            </Text>
          </View>

          {/* Existing request number */}
          {convertType === "existing" && selectedRequest && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("requests.selectedRequest")}</Text>
              <Text style={styles.summaryValue}>
                {selectedRequest.incident_number}{selectedRequest.title ? ` — ${selectedRequest.title}` : ""}
              </Text>
            </View>
          )}

          {/* Transition (only for new request) */}
          {convertType === "new" && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("requests.transition")}</Text>
              <Text style={styles.summaryValue}>{transitionName}</Text>
            </View>
          )}

          {/* Transition comment */}
          {convertType === "new" && transitionId && hasCommentRequirement && transitionComment ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("incidents.comment", "Comment")}</Text>
              <Text style={[styles.summaryValue, { flexShrink: 1 }]} numberOfLines={3}>{transitionComment}</Text>
            </View>
          ) : null}

          {/* Feedback rating */}
          {convertType === "new" && transitionId && hasFeedbackRequirement && feedbackRating > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("incidents.feedback")}</Text>
              <Text style={styles.summaryValue}>{"★".repeat(feedbackRating)}{"☆".repeat(5 - feedbackRating)} ({feedbackRating}/5)</Text>
            </View>
          ) : null}

          {/* Classification */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("details.classification")}</Text>
            <Text style={styles.summaryValue}>{classificationName}</Text>
          </View>

          {/* Workflow */}
          <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.summaryLabel}>{t("common.workflow")}</Text>
            <Text style={styles.summaryValue}>{workflowName}</Text>
          </View>
        </View>

        {/* Mandatory Feedback */}
        <View style={[styles.formGroup, { marginTop: 20 }]}>
          <Text style={styles.label}>
            {t("incidents.feedback")} <Text style={{ color: COLORS.error }}>*</Text>
          </Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={3}
            placeholder={t("incidents.feedbackCommentPlaceholder")}
            value={feedbackComment}
            onChangeText={setFeedbackComment}
          />
        </View>
      </View>
    );
  };


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {renderStepIndicator()}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {currentStepIndex === 0 && renderStep1()}
          {currentStepIndex === 1 && renderStep2()}
          {currentStepIndex === 2 && renderStep3()}
          {currentStepIndex === 3 && renderStep4()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Navigation */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.footerButtons}>
          <TouchableOpacity
            style={[styles.navButton, currentStepIndex === 0 && styles.navButtonDisabled]}
            onPress={handleBack}
            disabled={currentStepIndex === 0 || loading}
          >
            <Text style={[styles.navButtonText, currentStepIndex === 0 && styles.navButtonTextDisabled]}>
              {t("common.back", "Back")}
            </Text>
          </TouchableOpacity>

          {currentStepIndex < 3 ? (
            <TouchableOpacity style={styles.navButtonPrimary} onPress={handleNext}>
              <Text style={styles.navButtonTextPrimary}>{t("common.next", "Next")}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
                  <Text style={styles.submitButtonText}>{t("common.submit", "Submit")}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Modals */}
      <Modal visible={showWorkflowPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("common.workflow")}</Text>
              <TouchableOpacity onPress={() => setShowWorkflowPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {workflows.map(wf => (
                <TouchableOpacity
                  key={wf.id}
                  style={[styles.modalItem, workflowId === wf.id && styles.modalItemSelected]}
                  onPress={() => {
                    setWorkflowId(wf.id);
                    setShowWorkflowPicker(false);
                  }}
                >
                  <Text style={[styles.modalItemText, workflowId === wf.id && styles.modalItemTextSelected]}>
                    {wf.name}
                  </Text>
                  {workflowId === wf.id && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showTransitionPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("incidents.optionalTransition")}</Text>
              <TouchableOpacity onPress={() => setShowTransitionPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <TouchableOpacity
                style={[styles.modalItem, transitionId === "" && styles.modalItemSelected]}
                onPress={() => {
                  setTransitionId("");
                  setSelectedTransitionObj(null);
                  setTransitionComment("");
                  setFeedbackRating(0);
                  setFeedbackComment("");
                  setTransitionAttachment(null);
                  setShowTransitionPicker(false);
                }}
              >
                <Text style={[styles.modalItemText, transitionId === "" && styles.modalItemTextSelected]}>
                  {t("incidents.skipTransition")}
                </Text>
                {transitionId === "" && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
              </TouchableOpacity>

              {availableTransitions.map((t: any) => (
                <TouchableOpacity
                  key={t.transition.id}
                  style={[styles.modalItem, transitionId === t.transition.id && styles.modalItemSelected]}
                  onPress={() => {
                    setTransitionId(t.transition.id);
                    setSelectedTransitionObj(t);
                    setShowTransitionPicker(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalItemText, transitionId === t.transition.id && styles.modalItemTextSelected, { marginBottom: 4 }]}>
                      {t.transition.name}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.stateBadge, { backgroundColor: t.transition.from_state?.color ? `${t.transition.from_state.color}20` : '#f1f5f9' }]}>
                        <Text style={[styles.stateBadgeText, { color: t.transition.from_state?.color || COLORS.text.secondary }]}>
                          {t.transition.from_state?.name || "State"}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={12} color={COLORS.text.muted} style={{ marginHorizontal: 4 }} />
                      <View style={[styles.stateBadge, { backgroundColor: t.transition.to_state?.color ? `${t.transition.to_state.color}20` : '#f1f5f9' }]}>
                        <Text style={[styles.stateBadgeText, { color: t.transition.to_state?.color || COLORS.text.secondary }]}>
                          {t.transition.to_state?.name || "State"}
                        </Text>
                      </View>
                    </View>

                  </View>
                  {transitionId === t.transition.id && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.white,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  stepCircleActive: {
    backgroundColor: COLORS.accent,
  },
  stepCircleCompleted: {
    backgroundColor: '#059669', // Emerald 600
  },
  stepNumber: {
    color: COLORS.text.secondary,
    fontWeight: 'bold',
  },
  stepNumberActive: {
    color: COLORS.white,
  },
  stepLine: {
    height: 3,
    width: 40,
    backgroundColor: COLORS.border,
    marginHorizontal: -4,
    zIndex: 1,
  },
  stepLineCompleted: {
    backgroundColor: '#059669',
  },

  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 24,
    textAlign: "left"
  },

  scrollContent: { padding: 16, paddingBottom: 100 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", color: COLORS.text.primary, marginBottom: 8, textAlign: "left" },

  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.border,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
    textAlign: 'left'
  },
  toggleButtonTextActive: {
    color: COLORS.primary,
  },

  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text.primary
  },
  searchHint: {
    fontSize: 12,
    color: COLORS.text.muted,
    marginTop: 6,
  },

  searchResults: {
    marginTop: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  resultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  resultItemSelected: {
    backgroundColor: '#F0F9FF', // Light blue background
  },
  resultItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 4,
    textAlign: 'left'
  },
  resultItemTextSelected: {
    color: COLORS.primary,
  },
  resultItemDesc: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'left'
  },
  noResultsText: {
    marginTop: 12,
    textAlign: 'center',
    color: COLORS.text.muted,
    fontStyle: 'italic',
  },

  infoCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoCardLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 4,
    textAlign: 'left'
  },
  infoCardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 8,
    textAlign: 'left'
  },
  infoCardHelp: {
    fontSize: 12,
    color: COLORS.accent,
    fontStyle: 'italic',
    textAlign: 'left'
  },

  summaryCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
    flex: 1,
    textAlign: 'left'
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    flex: 2,
    textAlign: 'right',
  },

  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectorText: { fontSize: 16, color: COLORS.text.primary, textAlign: 'left' },
  placeholderText: { color: COLORS.text.muted },
  textArea: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text.primary,
    minHeight: 100,
    textAlignVertical: "top",
  },

  footer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  footerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  navButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  navButtonTextDisabled: {
    color: COLORS.text.muted,
  },
  navButtonPrimary: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  navButtonTextPrimary: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  submitButton: {
    flex: 2,
    backgroundColor: COLORS.accent,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text.primary },
  modalScroll: { padding: 8 },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
  },
  modalItemSelected: { backgroundColor: "#F0F9FF" },
  modalItemText: { fontSize: 16, color: COLORS.text.primary },
  modalItemTextSelected: { color: COLORS.primary, fontWeight: "600" },

  requirementsContainer: {
    marginTop: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  feedbackContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  feedbackHint: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedbackRatingText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  uploadButtonText: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  attachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  attachmentName: {
    fontSize: 14,
    color: COLORS.text.primary,
    flex: 1,
  },
  removeAttachmentButton: {
    padding: 4,
  },
  stateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
