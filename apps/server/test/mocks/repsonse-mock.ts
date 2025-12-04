export const mockResponse = () => {
  const response: any = {};
  response.send = jest.fn().mockReturnValue(response);
  response.sendStatus = jest.fn().mockReturnValue(response);
  response.cookie = jest.fn().mockReturnValue(response);
  response.clearCookie = jest.fn().mockReturnValue(response);
  return response;
};
