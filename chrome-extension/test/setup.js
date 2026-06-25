import '@testing-library/jest-dom';

global.ResizeObserver = global.ResizeObserver || class {
  observe() {} unobserve() {} disconnect() {}
};
