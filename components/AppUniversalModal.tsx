import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { MaskedTextInput } from "react-native-mask-text";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import * as ImagePicker from "expo-image-picker";

dayjs.extend(customParseFormat);

type ModalType = "service" | "schedule" | "rating" | "terms" | null;

type ServiceType = "CLEANING" | "SHOPPING" | "BEAUTY" | "HAIR_DRESSER";

interface AppUniversalModalProps {
  visible: boolean;
  modalType: ModalType;
  onClose: () => void;

  // Service modal props
  serviceType?: ServiceType | null;
  serviceLoading?: boolean;
  onServiceSubmit?: (data: {
    description: string;
    dateTime: string | null;
    imageUri?: string;
    isOrderNow?: boolean;
    subType?: string;
    selectedBeauty?: string[];
  }) => void;

  // Schedule modal props
  scheduleVehicleType?: string;
  setScheduleVehicleType?: (type: string) => void;
  vehicleOptions?: Array<{ value: string; label: string; icon: any }>;
  dateTimeString?: string;
  setDateTimeString?: (value: string) => void;
  isDateTimeValid?: boolean;
  dateTimeMask?: string;
  dateTimeFormat?: string;
  scheduleNote?: string;
  setScheduleNote?: (note: string) => void;
  scheduleWaiting?: boolean;
  onScheduleSubmit?: () => void;
  schedEditMode?: boolean;

  // Rating modal props
  ratingValue?: number;
  setRatingValue?: (value: number) => void;
  ratingFeedback?: string;
  setRatingFeedback?: (feedback: string) => void;
  submittingRating?: boolean;
  onRatingSubmit?: () => void;
  onRatingSkip?: () => void;
}

function StarRating({
  rating,
  setRating,
  disabled = false,
  size = 30,
}: {
  rating: number;
  setRating: (value: number) => void;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", marginVertical: 8 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity
          key={star}
          onPress={() => !disabled && setRating(star)}
          disabled={disabled}
        >
          <Text style={{
            fontSize: size,
            color: star <= rating ? "#FFD700" : "#bbb",
            marginHorizontal: 2,
          }}>
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function AppUniversalModal(props: AppUniversalModalProps) {
  const {
    visible,
    modalType,
    onClose,
    serviceType,
    serviceLoading,
    onServiceSubmit,
    scheduleVehicleType,
    setScheduleVehicleType,
    vehicleOptions,
    dateTimeString,
    setDateTimeString,
    isDateTimeValid,
    dateTimeMask,
    dateTimeFormat,
    scheduleNote,
    setScheduleNote,
    scheduleWaiting,
    onScheduleSubmit,
    schedEditMode,
    ratingValue,
    setRatingValue,
    ratingFeedback,
    setRatingFeedback,
    submittingRating,
    onRatingSubmit,
    onRatingSkip,
  } = props;

  // Service modal state
  const [description, setDescription] = useState("");
  const [serviceDateTimeString, setServiceDateTimeString] = useState("");
  const [isOrderNow, setIsOrderNow] = useState(true);
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [subType, setSubType] = useState("");
  const [selectedBeauty, setSelectedBeauty] = useState<string[]>([]);

  const beautyOptions = [
    "Facial",
    "Manicure",
    "Pedicure",
    "Massage",
    "Hair Styling",
    "Makeup",
  ];

  useEffect(() => {
    if (!visible || modalType !== "service") {
      // Reset service modal state when closed
      setDescription("");
      setServiceDateTimeString("");
      setIsOrderNow(true);
      setImageUri(undefined);
      setSubType("");
      setSelectedBeauty([]);
    }
  }, [visible, modalType]);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert("Permission to access camera roll is required!");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleServiceSubmit = () => {
    if (onServiceSubmit) {
      onServiceSubmit({
        description,
        dateTime: isOrderNow ? null : serviceDateTimeString,
        imageUri,
        isOrderNow,
        subType,
        selectedBeauty,
      });
    }
  };

  const toggleBeautyOption = (option: string) => {
    if (selectedBeauty.includes(option)) {
      setSelectedBeauty(selectedBeauty.filter(o => o !== option));
    } else {
      setSelectedBeauty([...selectedBeauty, option]);
    }
  };

  if (!visible || !modalType) return null;

  // Service Modal Content
  if (modalType === "service") {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={true}>
              <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 12 }}>
                {serviceType === "CLEANING" && "Cleaning Service"}
                {serviceType === "SHOPPING" && "Shopping Service"}
                {serviceType === "BEAUTY" && "Beauty Service"}
                {serviceType === "HAIR_DRESSER" && "Hair Dresser Service"}
              </Text>

              {/* Order Now / Schedule Later */}
              <View style={{ flexDirection: "row", marginBottom: 12 }}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    isOrderNow && styles.toggleBtnActive,
                  ]}
                  onPress={() => setIsOrderNow(true)}
                >
                  <Text style={{ fontWeight: "bold" }}>Order Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    !isOrderNow && styles.toggleBtnActive,
                  ]}
                  onPress={() => setIsOrderNow(false)}
                >
                  <Text style={{ fontWeight: "bold" }}>Schedule Later</Text>
                </TouchableOpacity>
              </View>

              {!isOrderNow && (
                <>
                  <Text style={{ fontSize: 15, marginBottom: 6 }}>
                    Date & Time (MM/DD/YYYY HH:MM)
                  </Text>
                  <MaskedTextInput
                    mask="99/99/9999 99:99"
                    style={styles.input}
                    value={serviceDateTimeString}
                    onChangeText={setServiceDateTimeString}
                    placeholder="MM/DD/YYYY HH:MM"
                    keyboardType="numbers-and-punctuation"
                  />
                </>
              )}

              {/* Service-specific fields */}
              {serviceType === "HAIR_DRESSER" && (
                <>
                  <Text style={{ fontSize: 15, marginBottom: 6 }}>
                    Service Type
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12 }}>
                    {["Haircut", "Coloring", "Styling", "Treatment"].map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.subTypeBtn,
                          subType === type && styles.subTypeBtnActive,
                        ]}
                        onPress={() => setSubType(type)}
                      >
                        <Text>{type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {serviceType === "BEAUTY" && (
                <>
                  <Text style={{ fontSize: 15, marginBottom: 6 }}>
                    Select Services
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12 }}>
                    {beautyOptions.map(option => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.subTypeBtn,
                          selectedBeauty.includes(option) && styles.subTypeBtnActive,
                        ]}
                        onPress={() => toggleBeautyOption(option)}
                      >
                        <Text>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={{ fontSize: 15, marginBottom: 6 }}>Description</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                placeholder={
                  serviceType === "CLEANING"
                    ? "What needs to be cleaned?"
                    : serviceType === "SHOPPING"
                    ? "What do you need?"
                    : "Service details"
                }
                value={description}
                onChangeText={setDescription}
                multiline
              />

              {serviceType === "SHOPPING" && (
                <>
                  <Text style={{ fontSize: 15, marginBottom: 6 }}>
                    Upload Shopping List (Optional)
                  </Text>
                  <TouchableOpacity
                    style={styles.imagePickerBtn}
                    onPress={handlePickImage}
                  >
                    <Text style={{ color: "#1976D2" }}>
                      {imageUri ? "Change Image" : "Pick an Image"}
                    </Text>
                  </TouchableOpacity>
                  {imageUri && (
                    <Image
                      source={{ uri: imageUri }}
                      style={{ width: 100, height: 100, marginTop: 10, borderRadius: 8 }}
                    />
                  )}
                </>
              )}

              <View style={{ flexDirection: "row", marginTop: 16 }}>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    { flex: 1, marginRight: 5 },
                    serviceLoading && { opacity: 0.7 },
                  ]}
                  onPress={handleServiceSubmit}
                  disabled={serviceLoading || !description}
                >
                  {serviceLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {isOrderNow ? "Submit" : "Schedule"}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelBtn, { flex: 1, marginLeft: 5 }]}
                  onPress={onClose}
                  disabled={serviceLoading}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // Schedule Modal Content
  if (modalType === "schedule") {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 12 }}>
              {schedEditMode ? "Edit Scheduled Request" : "Schedule a Request"}
            </Text>
            <Text style={{ fontSize: 15, marginBottom: 6 }}>Service Type</Text>
            <View style={[styles.vehicleOptions, { marginBottom: 8 }]}>
              {vehicleOptions?.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.vehicleButton,
                    scheduleVehicleType === opt.value && styles.vehicleButtonSelected,
                  ]}
                  onPress={() => setScheduleVehicleType?.(opt.value)}
                >
                  <Image source={opt.icon} style={{ width: 32, height: 32 }} />
                  <Text style={{ fontWeight: "bold", marginTop: 2 }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: 15, marginBottom: 6 }}>
              Date & Time {dateTimeFormat || "MM/DD/YYYY HH:MM"}
            </Text>
            <MaskedTextInput
              mask={dateTimeMask || "99/99/9999 99:99"}
              style={styles.input}
              value={dateTimeString || ""}
              onChangeText={setDateTimeString || (() => {})}
              placeholder={dateTimeFormat || "MM/DD/YYYY HH:mm"}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!isDateTimeValid && !!dateTimeString && (
              <Text style={{ color: "#d32f2f", textAlign: "center", marginBottom: 6 }}>
                Enter a valid date & time
              </Text>
            )}
            <Text style={{ fontSize: 15, marginBottom: 4, marginTop: 10 }}>
              Note (optional)
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Message to provider"
              value={scheduleNote || ""}
              onChangeText={setScheduleNote || (() => {})}
            />
            <View style={styles.scheduleActionRow}>
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { flex: 1, marginRight: 5 },
                  !isDateTimeValid && { opacity: 0.5 },
                ]}
                onPress={onScheduleSubmit}
                disabled={scheduleWaiting || !isDateTimeValid}
              >
                <Text style={styles.submitBtnText}>
                  {scheduleWaiting
                    ? schedEditMode
                      ? "Saving..."
                      : "Scheduling..."
                    : schedEditMode
                    ? "Save Changes"
                    : "Confirm"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelBtn, { flex: 1, marginLeft: 5 }]}
                onPress={onClose}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Rating Modal Content
  if (modalType === "rating") {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.ratingModalContent}>
            <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 14, textAlign: "center" }}>
              Rate Your Provider
            </Text>
            <StarRating
              rating={ratingValue || 5}
              setRating={setRatingValue || (() => {})}
              disabled={submittingRating}
            />
            <TextInput
              style={styles.input}
              placeholder="Write feedback (optional)"
              value={ratingFeedback || ""}
              onChangeText={setRatingFeedback || (() => {})}
              editable={!submittingRating}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { marginTop: 8 },
                submittingRating && { opacity: 0.7 },
              ]}
              onPress={onRatingSubmit}
              disabled={submittingRating || !ratingValue}
            >
              <Text style={styles.submitBtnText}>
                {submittingRating ? "Submitting..." : "Submit"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelBtn, { marginTop: 6 }]}
              onPress={onRatingSkip || onClose}
              disabled={submittingRating}
            >
              <Text style={styles.cancelBtnText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    width: "90%",
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOpacity: 0.17,
    shadowRadius: 12,
    elevation: 8,
  },
  ratingModalContent: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    width: "90%",
    shadowColor: "#000",
    shadowOpacity: 0.17,
    shadowRadius: 12,
    elevation: 8,
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 9,
    marginBottom: 6,
    fontSize: 14,
    backgroundColor: "#f8f8f8",
    alignSelf: "stretch",
  },
  toggleBtn: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    marginHorizontal: 4,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: "#1976D2",
    borderColor: "#1976D2",
  },
  subTypeBtn: {
    padding: 8,
    margin: 4,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  subTypeBtnActive: {
    backgroundColor: "#1976D2",
    borderColor: "#1976D2",
  },
  imagePickerBtn: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#1976D2",
    borderRadius: 8,
    alignItems: "center",
  },
  submitBtn: {
    backgroundColor: "#1976D2",
    borderRadius: 7,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
    textAlign: "center",
  },
  cancelBtn: {
    backgroundColor: "#d32f2f",
    borderRadius: 7,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  cancelBtnText: {
    color: "#fff",
    fontWeight: "bold",
  },
  vehicleOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  vehicleButton: {
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    margin: 2,
    backgroundColor: "#fff",
  },
  vehicleButtonSelected: {
    borderColor: "#1976D2",
    backgroundColor: "#e6f0ff",
  },
  scheduleActionRow: {
    flexDirection: "row",
    marginTop: 13,
    justifyContent: "space-between",
    alignItems: "center",
  },
});
