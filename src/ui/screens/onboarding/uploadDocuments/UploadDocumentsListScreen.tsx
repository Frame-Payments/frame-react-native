import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import { DropDown } from '../../../primitives/DropDown';
import type { IdDocumentType, OnboardingState } from '../onboardingReducer';
import { FORM_SPACING } from '../formSpacing';

// Document upload checklist. The user picks an ID type, then taps each row
// (Front / Back / Selfie) to capture. Back is hidden for passport — single
// page. Submit fires when all required photos are captured.

const ID_TYPE_OPTIONS: ReadonlyArray<{ value: IdDocumentType; label: string }> = [
  { value: 'drivers_license', label: "Driver's license" },
  { value: 'passport', label: 'Passport' },
  { value: 'state_id', label: 'State ID' },
  { value: 'military_id', label: 'Military ID' },
];

export interface UploadDocumentsListScreenProps {
  state: OnboardingState;
  onChangeIdType: (value: IdDocumentType) => void;
  onCaptureFront: () => void;
  onCaptureBack: () => void;
  onCaptureSelfie: () => void;
  onSubmit: () => void;
  isComplete: boolean;
}

export function UploadDocumentsListScreen({
  state,
  onChangeIdType,
  onCaptureFront,
  onCaptureBack,
  onCaptureSelfie,
  onSubmit,
  isComplete,
}: UploadDocumentsListScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const idType = state.docs.idType;
  const requiresBack = idType !== null && idType !== 'passport';

  // Auto-select drivers_license on first render so the dropdown's UI state
  // matches the reducer state. Without this, the UI looks like an ID type is
  // picked but areDocsComplete returns false (because idType is null).
  useEffect(() => {
    if (idType === null) onChangeIdType('drivers_license');
    // Only fires on initial mount when idType is null; if the user picks a
    // different type later the dependency is stable and this effect no-ops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text
          style={[
            styles.heading,
            {
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.heading.size,
              fontWeight: theme.fontWeights.heading,
              lineHeight: theme.fontLineHeights.heading,
            },
          ]}
        >
          Upload your ID
        </Text>
        <Text
          style={[
            styles.body,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.fonts.body.size,
              lineHeight: theme.fontLineHeights.body,
            },
          ]}
        >
          We'll need a clear photo of your ID and a selfie to verify your identity.
        </Text>

        <DropDown
          prompt="ID type"
          options={ID_TYPE_OPTIONS}
          selected={idType ?? 'drivers_license'}
          onSelect={onChangeIdType}
          testID="onboarding.docs.idtype"
        />

        {idType ? (
          <View style={styles.rows}>
            <DocRow
              title="Front of ID"
              done={state.docs.front !== null}
              onPress={onCaptureFront}
              testID="onboarding.docs.front"
            />
            {requiresBack ? (
              <DocRow
                title="Back of ID"
                done={state.docs.back !== null}
                onPress={onCaptureBack}
                testID="onboarding.docs.back"
              />
            ) : null}
            <DocRow
              title="Selfie"
              done={state.docs.selfie !== null}
              onPress={onCaptureSelfie}
              testID="onboarding.docs.selfie"
            />
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          text="Submit for verification"
          enabled={isComplete && !state.isPerformingAction}
          isLoading={state.isPerformingAction}
          onPress={onSubmit}
        />
      </View>
    </View>
  );
}

interface DocRowProps {
  title: string;
  done: boolean;
  onPress: () => void;
  testID?: string;
}

function DocRow({ title, done, onPress, testID }: DocRowProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View
      style={[
        styles.row,
        {
          borderColor: done ? theme.colors.textPrimary : theme.colors.surfaceStroke,
          borderRadius: theme.radii.medium,
        },
      ]}
      testID={testID}
    >
      <View style={styles.rowText}>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.fonts.body.size,
            fontWeight: theme.fontWeights.label,
            lineHeight: theme.fontLineHeights.body,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: done ? theme.colors.textPrimary : theme.colors.textSecondary,
            fontSize: theme.fonts.bodySmall.size,
            marginTop: 2,
          }}
        >
          {done ? '✓ Captured · Tap to retake' : 'Tap to capture'}
        </Text>
      </View>
      <Button
        text={done ? 'Retake' : 'Capture'}
        variant="secondary"
        onPress={onPress}
        style={{ minWidth: 100 }}
      />
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: FORM_SPACING.contentHorizontal,
      paddingBottom: FORM_SPACING.contentBottom,
    },
    heading: {
      marginTop: FORM_SPACING.headingTop,
      marginBottom: FORM_SPACING.headingBottom,
    },
    body: {
      marginBottom: FORM_SPACING.subheadBottom,
    },
    rows: {
      marginTop: FORM_SPACING.sectionBottom,
      gap: FORM_SPACING.fieldGap,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: FORM_SPACING.fieldGap,
      paddingHorizontal: FORM_SPACING.fieldGap,
      gap: FORM_SPACING.fieldGap,
    },
    rowText: {
      flex: 1,
    },
    footer: {
      paddingHorizontal: FORM_SPACING.footerHorizontal,
      paddingVertical: FORM_SPACING.footerVertical,
    },
  });
}
