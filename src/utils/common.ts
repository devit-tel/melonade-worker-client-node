export const jsonTryParse = (jsonString: string, defaultValue: any = {}) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
};
