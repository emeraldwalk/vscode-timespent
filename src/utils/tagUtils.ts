import type { Tag } from '../types';

export function isTagEqual(tag1: Tag, tag2: Tag): boolean {
  return (
    tag1.fileUri?.toString() === tag2.fileUri?.toString() &&
    tag1.gitBranch?.commit === tag2.gitBranch?.commit &&
    tag1.gitBranch?.name === tag2.gitBranch?.name
  );
}
