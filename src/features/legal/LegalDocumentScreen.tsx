import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen, ScreenHeader, Spacer } from '../../components/layout';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import { apiRequest } from '../../lib/api';
import type { AuthStackParams, LegalDocId } from '../../navigation/types';
import { LEGAL_DOCS, LegalDocument } from './legalDocs';

export const legalService = {
  getDocument: (id: LegalDocId) => apiRequest<LegalDocument>(`/legal/documents/${id}`),
};

export function useLegalDocument(id: LegalDocId) {
  return useQuery({
    queryKey: ['legal', 'document', id],
    queryFn: () => legalService.getDocument(id),
    placeholderData: LEGAL_DOCS[id],
    staleTime: 3600000,
  });
}

export function LegalDocumentScreen() {
  const { t } = useI18n();
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<AuthStackParams, 'LegalDocument'>>();
  const { data: fetched } = useLegalDocument(params.docId);
  const data = fetched ?? LEGAL_DOCS[params.docId];

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <ScreenHeader title={data.title} onBack={() => navigation.goBack()} backLabel={t('common.back')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {data.updated ? (
          <>
            <Text variant="caption" tone="muted">
              {data.updated}
            </Text>
            <Spacer size="lg" />
          </>
        ) : null}
        {data.sections.map((section, i) => (
          <View key={i} style={styles.section}>
            {section.heading ? (
              <>
                <Text variant="heading">{section.heading}</Text>
                <Spacer size="xs" />
              </>
            ) : null}
            <Text variant="body" tone="secondary" style={styles.bodyText}>
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create(theme => ({
  content: { paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xl3 },
  section: { paddingBottom: theme.spacing.lg },
  bodyText: { lineHeight: 22 },
}));
