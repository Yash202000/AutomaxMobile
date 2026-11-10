import { getClassificationsTree } from "@/src/api/classifications";
import { convertToRequest, getIncidents } from "@/src/api/incidents";
import { getWorkflows } from "@/src/api/workflow";
import { CustomAlert } from "@/src/components/CustomAlert";
import TreeSelect, { TreeNode } from "@/src/components/TreeSelect";
import i18n from "@/src/i18n";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const { id } = useLocalSearchParams();
  const incidentId = Array.isArray(id) ? id[0] : id;

  const [loading, setLoading] = useState(false);

  // Data
  const [classifications, setClassifications] = useState<TreeNode[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);

  // Wizard State (New Request skips step 1 and starts at Classification)
  const [currentStepIndex, setCurrentStepIndex] = useState(1);

  // Step 1: New / Existing request
  const [convertType, setConvertType] = useState<"new" | "existing">("new");
  const firstStepIndex = convertType === "new" ? 1 : 0;

  // -- For existing
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedRequests, setSearchedRequests] = useState<any[]>([]);
  const [searchingRequests, setSearchingRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [convertableRequestId, setConvertableRequestId] = useState<string>("");

  // -- For new
  const [feedbackComment, setFeedbackComment] = useState("");
  // Step 2: Classification
  const [classificationId, setClassificationId] = useState("");

  // Step 3: Workflow
  const [workflowId, setWorkflowId] = useState("");
  const [showWorkflowPicker, setShowWorkflowPicker] = useState(false);

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
        getClassificationsTree("both"),
      ]);

      let combined: any[] = [];
      if (classResRequest.success)
        combined = [...combined, ...classResRequest.data];
      if (classResBoth.success) combined = [...combined, ...classResBoth.data];

      const uniqueClassifications = Array.from(
        new Map(combined.map((item) => [item.id, item])).values(),
      );
      setClassifications(uniqueClassifications as TreeNode[]);

      const wfRes = await getWorkflows(true, "request");
      if (wfRes.success) {
        const fetchedWorkflows = wfRes.data || [];
        setWorkflows(fetchedWorkflows);
        if (fetchedWorkflows.length === 1) {
          const convertableRequestState =
            fetchedWorkflows[0].states.find(
              (x: any) => x.state_type === "initial",
            )?.id || "";
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
      const params: Record<string, any> = {
        record_type: "request",
        limit: 15,
        current_state_id: convertableRequestId,
      };
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

  const handleNext = () => {
    if (currentStepIndex === 0) {
      if (convertType === "existing" && !selectedRequest) {
        CustomAlert.alert(
          t("common.error"),
          t("incidents.pleaseSelectRequest"),
        );
        return;
      }


      setCurrentStepIndex(1);
    } else if (currentStepIndex === 1) {
      // If they chose an existing request, and it already has a classification, we could pre-fill it.
      // But let's just validate.
      if (
        !classificationId &&
        (!selectedRequest || !selectedRequest.classification_id)
      ) {
        CustomAlert.alert(
          t("common.error"),
          t("incidents.pleaseSelectClassification"),
        );
        return;
      }
      setCurrentStepIndex(2);
    } else if (currentStepIndex === 2) {
      if (!workflowId && (!selectedRequest || !selectedRequest.workflow_id)) {
        CustomAlert.alert(
          t("common.error"),
          t("incidents.pleaseSelectWorkflow"),
        );
        return;
      }
      setCurrentStepIndex(3);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > firstStepIndex) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!feedbackComment.trim()) {
      CustomAlert.alert(
        t("common.error"),
        t(
          "incidents.feedbackMandatoryError",
          "Feedback comment is required to submit.",
        ),
      );
      return;
    }

    setLoading(true);
    try {
      // Build convert payload
      const payload: any = {
        classification_id:
          selectedRequest?.classification?.id || classificationId,
        workflow_id: selectedRequest?.workflow?.id || workflowId,
      };

      if (convertType === "existing" && selectedRequest) {
        payload.existing_request_id = selectedRequest.id;
      }

      // Feedback is mandatory for every conversion (new or existing) — matches web behavior
      payload.feedback = {
        rating: 0,
        comment: feedbackComment.trim(),
      };

      const response = await convertToRequest(incidentId, payload);

      if (response.success) {
        CustomAlert.alert(
          t("common.success"),
          t("incidents.convertedSuccessfully"),
          [{ text: t("common.ok"), onPress: () => router.back() }],
        );
      } else {
        CustomAlert.alert(
          t("common.error"),
          response.error || t("errors.unknownError"),
        );
      }
    } catch (err: any) {
      CustomAlert.alert(
        t("common.error"),
        err.message || t("errors.unknownError"),
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = convertType === "new" ? [1, 2, 3] : [1, 2, 3, 4];
    return (
      <View style={styles.stepIndicatorContainer}>
        {steps.map((step, index) => {
          const isActive = index === currentStepIndex - firstStepIndex;
          const isCompleted = index < currentStepIndex - firstStepIndex;

          return (
            <React.Fragment key={index}>
              <View
                style={[
                  styles.stepCircle,
                  isActive && styles.stepCircleActive,
                  isCompleted && styles.stepCircleCompleted,
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={16} color={COLORS.white} />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      isActive && styles.stepNumberActive,
                    ]}
                  >
                    {step}
                  </Text>
                )}
              </View>
              {index < steps.length - 1 && (
                <View
                  style={[
                    styles.stepLine,
                    isCompleted && styles.stepLineCompleted,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  // New / Existing toggle (shown on the first step of either flow)
  const renderTypeToggle = () => (
    <View style={styles.toggleContainer}>
      <TouchableOpacity
        style={[
          styles.toggleButton,
          convertType === "new" && styles.toggleButtonActive,
        ]}
        onPress={() => {
          setConvertType("new");
          setCurrentStepIndex(1);
        }}
      >
        <Text
          style={[
            styles.toggleButtonText,
            convertType === "new" && styles.toggleButtonTextActive,
          ]}
        >
          {t("requests.newRequest")}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.toggleButton,
          convertType === "existing" && styles.toggleButtonActive,
        ]}
        onPress={() => {
          setConvertType("existing");
          setCurrentStepIndex(0);
        }}
      >
        <Text
          style={[
            styles.toggleButtonText,
            convertType === "existing" && styles.toggleButtonTextActive,
          ]}
        >
          {t("requests.existingRequest")}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t("requests.transition")}</Text>

      {renderTypeToggle()}

      {convertType === "existing" ? (
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t("requests.searchRequest")} *</Text>
          <View style={styles.searchInputContainer}>
            <Ionicons
              name="search"
              size={20}
              color={COLORS.text.muted}
              style={styles.searchIcon}
            />
            <TextInput
              style={[
                styles.searchInput,
                { textAlign: i18n.language === "ar" ? "right" : "left" },
              ]}
              placeholder={t("requests.searchRequestPlaceholder")}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {searchingRequests && (
            <ActivityIndicator
              style={{ marginTop: 10 }}
              color={COLORS.accent}
            />
          )}

          {!searchingRequests &&
            !searchQuery &&
            searchedRequests.length > 0 && (
              <Text style={styles.searchHint}>
                {t("requests.searchRequestHint")}
              </Text>
            )}

          {!searchingRequests && searchedRequests.length > 0 && (
            <View style={styles.searchResults}>
              {searchedRequests.map((req) => (
                <TouchableOpacity
                  key={req.id}
                  style={[
                    styles.resultItem,
                    selectedRequest?.id === req.id && styles.resultItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedRequest(req);
                    // Pre-fill classification/workflow if available
                    if (req.classification?.id)
                      setClassificationId(req.classification.id);
                    if (req.workflow?.id) setWorkflowId(req.workflow.id);
                  }}
                >
                  <Text
                    style={[
                      styles.resultItemTitle,
                      selectedRequest?.id === req.id &&
                        styles.resultItemTextSelected,
                    ]}
                  >
                    {req.incident_number}
                  </Text>
                  <Text style={styles.resultItemDesc} numberOfLines={1}>
                    {req.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!searchingRequests &&
            searchQuery &&
            searchedRequests.length === 0 && (
              <Text style={styles.noResultsText}>
                {t("common.noResults", "No Results")}
              </Text>
            )}
        </View>
      ) : null}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>
        {t("details.classification", "Classification")}
      </Text>

      {convertType === "new" && renderTypeToggle()}

      {convertType === "existing" && selectedRequest?.classification ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardLabel}>
            {t("details.classification", "Classification")}
          </Text>
          <Text style={styles.infoCardValue}>
            {selectedRequest.classification.name}
          </Text>
          <Text style={styles.infoCardHelp}>
            {t(
              "requests.inheritedFromExisting",
              "Inherited from existing request",
            )}
          </Text>
        </View>
      ) : (
        <View style={styles.formGroup}>
          <TreeSelect
            label={t("details.classification")}
            value={
              classificationId
                ? (classifications as any).find(
                    (c: any) => c.id === classificationId,
                  )?.name || classificationId
                : ""
            }
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
          <Text style={styles.infoCardLabel}>
            {t("common.workflow", "Workflow")}
          </Text>
          <Text style={styles.infoCardValue}>
            {selectedRequest.workflow.name}
          </Text>
          <Text style={styles.infoCardHelp}>
            {t(
              "requests.inheritedFromExisting",
              "Inherited from existing request",
            )}
          </Text>
        </View>
      ) : (
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t("common.workflow")} *</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => setShowWorkflowPicker(true)}
          >
            <Text
              style={[
                styles.selectorText,
                !workflowId && styles.placeholderText,
              ]}
            >
              {workflowId
                ? workflows.find((w) => w.id === workflowId)?.name || workflowId
                : t("incidents.selectWorkflow")}
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={COLORS.text.secondary}
            />
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
    const classificationName =
      convertType === "existing" && selectedRequest?.classification
        ? selectedRequest.classification.name
        : findClassificationName(classifications as any[], classificationId) ||
          classificationId ||
          t("common.na");

    const workflowName =
      convertType === "existing" && selectedRequest?.workflow
        ? selectedRequest.workflow.name
        : workflows.find((w) => w.id === workflowId)?.name ||
          workflowId ||
          t("common.na");

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{t("requests.review")}</Text>

        <View style={styles.summaryCard}>
          {/* Type */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("requests.type")}</Text>
            <Text style={styles.summaryValue}>
              {convertType === "existing"
                ? t("requests.existingRequest")
                : t("requests.newRequest")}
            </Text>
          </View>

          {/* Existing request number */}
          {convertType === "existing" && selectedRequest && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {t("requests.selectedRequest")}
              </Text>
              <Text style={styles.summaryValue}>
                {selectedRequest.incident_number}
                {selectedRequest.title ? ` — ${selectedRequest.title}` : ""}
              </Text>
            </View>
          )}


          {/* Classification */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {t("details.classification")}
            </Text>
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
            {t("incidents.feedback")}{" "}
            <Text style={{ color: COLORS.error }}>*</Text>
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
      <View style={styles.header}>{renderStepIndicator()}</View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {currentStepIndex === 0 && renderStep1()}
          {currentStepIndex === 1 && renderStep2()}
          {currentStepIndex === 2 && renderStep3()}
          {currentStepIndex === 3 && renderStep4()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Navigation */}
      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}
      >
        <View style={styles.footerButtons}>
          <TouchableOpacity
            style={[
              styles.navButton,
              currentStepIndex === firstStepIndex && styles.navButtonDisabled,
            ]}
            onPress={handleBack}
            disabled={currentStepIndex === firstStepIndex || loading}
          >
            <Text
              style={[
                styles.navButtonText,
                currentStepIndex === firstStepIndex &&
                  styles.navButtonTextDisabled,
              ]}
            >
              {t("common.back", "Back")}
            </Text>
          </TouchableOpacity>

          {currentStepIndex < 3 ? (
            <TouchableOpacity
              style={styles.navButtonPrimary}
              onPress={handleNext}
            >
              <Text style={styles.navButtonTextPrimary}>
                {t("common.next", "Next")}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color={COLORS.white}
                  />
                  <Text style={styles.submitButtonText}>
                    {t("common.submit", "Submit")}
                  </Text>
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
              {workflows.map((wf) => (
                <TouchableOpacity
                  key={wf.id}
                  style={[
                    styles.modalItem,
                    workflowId === wf.id && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setWorkflowId(wf.id);
                    setShowWorkflowPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      workflowId === wf.id && styles.modalItemTextSelected,
                    ]}
                  >
                    {wf.name}
                  </Text>
                  {workflowId === wf.id && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={COLORS.primary}
                    />
                  )}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  stepCircleActive: {
    backgroundColor: COLORS.accent,
  },
  stepCircleCompleted: {
    backgroundColor: "#059669", // Emerald 600
  },
  stepNumber: {
    color: COLORS.text.secondary,
    fontWeight: "bold",
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
    backgroundColor: "#059669",
  },

  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.text.primary,
    marginBottom: 24,
    textAlign: "left",
  },

  scrollContent: { padding: 16, paddingBottom: 100 },
  formGroup: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 8,
    textAlign: "left",
  },

  toggleContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.border,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.secondary,
    textAlign: "left",
  },
  toggleButtonTextActive: {
    color: COLORS.primary,
  },

  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
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
    color: COLORS.text.primary,
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
    overflow: "hidden",
  },
  resultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  resultItemSelected: {
    backgroundColor: "#F0F9FF", // Light blue background
  },
  resultItemTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text.primary,
    marginBottom: 4,
    textAlign: "left",
  },
  resultItemTextSelected: {
    color: COLORS.primary,
  },
  resultItemDesc: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: "left",
  },
  noResultsText: {
    marginTop: 12,
    textAlign: "center",
    color: COLORS.text.muted,
    fontStyle: "italic",
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
    textTransform: "uppercase",
    marginBottom: 4,
    textAlign: "left",
  },
  infoCardValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text.primary,
    marginBottom: 8,
    textAlign: "left",
  },
  infoCardHelp: {
    fontSize: 12,
    color: COLORS.accent,
    fontStyle: "italic",
    textAlign: "left",
  },

  summaryCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
    flex: 1,
    textAlign: "left",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
    flex: 2,
    textAlign: "right",
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
  selectorText: { fontSize: 16, color: COLORS.text.primary, textAlign: "left" },
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  navButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  navButtonTextDisabled: {
    color: COLORS.text.muted,
  },
  navButtonPrimary: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: COLORS.primary,
  },
  navButtonTextPrimary: {
    fontSize: 16,
    fontWeight: "bold",
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

});
