import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 30000,
});

export const classifyWaste = async (imageFile) => {
  const formData = new FormData();

  formData.append("file", imageFile);

  const response = await API.post("/predict", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export default API;