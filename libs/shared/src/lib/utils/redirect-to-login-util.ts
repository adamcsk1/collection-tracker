export const redirectToLogin = () => {
  try {
    window.location.assign('/login/');
  } catch {}
};
