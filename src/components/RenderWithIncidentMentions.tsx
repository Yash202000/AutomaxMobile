import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

interface RenderWithIncidentMentionsProps {
  text: string;
  style?: any;
}

export const RenderWithIncidentMentions: React.FC<RenderWithIncidentMentionsProps> = ({ text, style }) => {
  const router = useRouter();
  if (!text) return null;

  // Match both: @[incidentNumber](incident:incidentId) and @{incidentNumber:incidentId}
  const regex = /@\[([^\]]+)\]\(incident:([^)]+)\)|@\{([^:]+):([^}]+)\}/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  regex.lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const incidentNumber = match[1] || match[3];
    const incidentId = match[2] || match[4];

    if (matchIndex > lastIndex) {
      elements.push(
        <Text key={`text-${lastIndex}`} style={style}>
          {text.substring(lastIndex, matchIndex)}
        </Text>
      );
    }

    elements.push(
      <Text
        key={`mention-${incidentId}-${matchIndex}`}
        style={[styles.mentionText, style]}
        onPress={() => {
          router.push({
            pathname: '/incident-details',
            params: { id: incidentId },
          });
        }}
      >
        {`@${incidentNumber}`}
      </Text>
    );

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(
      <Text key={`text-${lastIndex}`} style={style}>
        {text.substring(lastIndex)}
      </Text>
    );
  }

  return (
    <Text style={style}>
      {elements.length > 0 ? elements : text}
    </Text>
  );
};

const styles = StyleSheet.create({
  mentionText: {
    color: '#2EC4B6',
    fontWeight: '600',
    textDecorationLine: 'underline'
  },
});
