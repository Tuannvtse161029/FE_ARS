/**
 * Regression test for the September 2026 bug where materials attached
 * to a Research Topic did NOT surface in the lecturer's Group Detail
 * page. `MaterialsDisplay` must render BOTH:
 *   1. Materials attached to the group's Research Topic (via
 *      `useTopicLearningMaterials`)
 *   2. The lecturer's general LearningMaterial library (via
 *      `useLearningMaterials`)
 *
 * The previous version of the component only accepted the lecturer
 * library, silently dropping every topic attachment.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Hardcoded English labels for the keys used by `MaterialsDisplay`.
// Anything not in this map falls back to the key itself, matching the
// real i18n contract: the runtime dictionary lookup is what provides
// the localised value; this test only asserts the structure.
const I18N: Record<string, string> = {
  'lecturer.groupDetail.learningMaterialsTitle': 'Learning materials',
  'lecturer.groupDetail.learningMaterialsHint': 'Materials attached by your lecturer.',
  'lecturer.groupDetail.topicMaterialsTitle': 'Materials attached to this topic',
  'lecturer.groupDetail.libraryMaterialsTitle': 'Lecturer library',
  'lecturer.groupDetail.noTopicMaterials': 'No materials are attached to this group’s research topic yet.',
  'lecturer.groupDetail.noMaterials': 'No learning materials attached yet.',
  'lecturer.groupDetail.loadingMaterials': 'Loading materials…',
  'lecturer.groupDetail.materialPrefix': 'Material #',
  'lecturer.groupDetail.open': 'Open',
  'lecturer.groupDetail.retry': 'Retry',
};
vi.mock('../../../../../src/i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string) => I18N[key] ?? key,
  }),
  useLocale: () => 'en',
}));

import { MaterialsDisplay } from '../../../../../src/features/guidance/components/MaterialsDisplay';

describe('<MaterialsDisplay>', () => {
  beforeEach(() => {
    // intentionally empty
  });

  it('renders the topic-attached materials section when topicMaterials is provided', () => {
    render(
      <MaterialsDisplay
        materials={[]}
        topicMaterials={[
          {
            id: 100,
            learningMaterialId: 100,
            title: 'Topic-level reading list',
            fileUrl: 'https://cdn.example.com/topic.pdf',
            description: 'Required before milestone 1',
            lecturerId: 7,
          },
        ]}
        isLoading={false}
        isTopicLoading={false}
        error={null}
        onRetry={() => undefined}
      />,
    );

    // Section heading is rendered.
    expect(
      screen.getByText('Materials attached to this topic'),
    ).toBeInTheDocument();

    // The list container has the test id we use elsewhere.
    const list = screen.getByTestId('topic-materials-list');
    expect(list).toBeInTheDocument();

    // The title and an "Open" link are rendered.
    expect(screen.getByText('Topic-level reading list')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();

    // The description is rendered.
    expect(
      screen.getByText('Required before milestone 1'),
    ).toBeInTheDocument();
  });

  it('falls back to the lecturer library section when there are no topic materials', () => {
    render(
      <MaterialsDisplay
        materials={[
          {
            id: 1,
            learningMaterialId: 1,
            title: 'Library-only material',
            fileUrl: 'https://cdn.example.com/library.pdf',
            description: null,
            lecturerId: 7,
          },
        ]}
        topicMaterials={[]}
        isLoading={false}
        isTopicLoading={false}
        error={null}
        onRetry={() => undefined}
      />,
    );

    expect(screen.getByText('Lecturer library')).toBeInTheDocument();
    expect(screen.getByText('Library-only material')).toBeInTheDocument();
    // Topic section heading is NOT rendered when there are no topic materials.
    expect(
      screen.queryByText('Materials attached to this topic'),
    ).not.toBeInTheDocument();
  });

  it('renders BOTH sections when both buckets have entries', () => {
    render(
      <MaterialsDisplay
        materials={[
          {
            id: 1,
            learningMaterialId: 1,
            title: 'Library material',
            fileUrl: 'https://cdn.example.com/lib.pdf',
            description: null,
            lecturerId: 7,
          },
        ]}
        topicMaterials={[
          {
            id: 2,
            learningMaterialId: 2,
            title: 'Topic material',
            fileUrl: 'https://cdn.example.com/topic.pdf',
            description: null,
            lecturerId: 7,
          },
        ]}
        isLoading={false}
        isTopicLoading={false}
        error={null}
        onRetry={() => undefined}
      />,
    );

    expect(screen.getByText('Materials attached to this topic')).toBeInTheDocument();
    expect(screen.getByText('Lecturer library')).toBeInTheDocument();
    expect(screen.getByText('Topic material')).toBeInTheDocument();
    expect(screen.getByText('Library material')).toBeInTheDocument();
  });

  it('renders an empty-state hint when the group has a topic but no attachments yet', () => {
    render(
      <MaterialsDisplay
        materials={[]}
        topicMaterials={[]}
        isLoading={false}
        isTopicLoading={false}
        error={null}
        onRetry={() => undefined}
      />,
    );

    // The "no topic materials" copy should be visible because we are
    // intentionally hiding the topic section when there is NO topic
    // AND nothing to show — so we instead just show the global
    // "no materials" copy.
    expect(
      screen.queryByText('Materials attached to this topic'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('No learning materials attached yet.')).toBeInTheDocument();
  });

  it('shows a retry button when the topic endpoint errors', () => {
    const onRetryTopic = vi.fn();
    render(
      <MaterialsDisplay
        materials={[]}
        topicMaterials={[]}
        isLoading={false}
        isTopicLoading={false}
        error={null}
        topicError={{ message: 'topic endpoint down' }}
        onRetry={() => undefined}
        onRetryTopic={onRetryTopic}
      />,
    );

    // The topic section is rendered because there is a topic-level error.
    expect(
      screen.getByText('Materials attached to this topic'),
    ).toBeInTheDocument();
    expect(screen.getByText('topic endpoint down')).toBeInTheDocument();

    // The retry button is rendered and clicks through.
    const retryButtons = screen.getAllByRole('button', { name: /retry/i });
    // The first retry button should be the topic-level one.
    retryButtons[0]?.click();
    expect(onRetryTopic).toHaveBeenCalledTimes(1);
  });
});
