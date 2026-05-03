module.exports = {
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'chore']],
    'type-empty': [2, 'never'], // Prevents empty type like ": message"
    'subject-empty': [2, 'never'], // Prevents empty subject like "feat:"
  },
};
