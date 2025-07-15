declare global {
  function createMockUser(): any;
  function createMockTask(): any;
  
  namespace NodeJS {
    interface Global {
      createMockUser(): any;
      createMockTask(): any;
    }
  }
}
