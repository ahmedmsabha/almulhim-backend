const createMockClient = () => ({
  withRule: jest.fn().mockReturnThis(),
  protect: jest.fn(),
});

export default jest.fn(() => createMockClient());

export const shield = jest.fn();
export const slidingWindow = jest.fn();
export const detectBot = jest.fn();
