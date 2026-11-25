const fs = require("fs/promises");
const cloudinary = require("../../config/cloudinary");
const uploadToCloudinary = require("../cloudinary.middleware");

jest.mock("../../config/cloudinary", () => ({
  uploader: {
    upload: jest.fn(),
    upload_large: jest.fn(),
    destroy: jest.fn(),
  },
}));
jest.mock("fs/promises", () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));

describe("uploadToCloudinary middleware", () => {
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  it("uploads multiple files, categorizes urls, and unlinks temp files", async () => {
    cloudinary.uploader.upload
      .mockResolvedValueOnce({
        secure_url: "https://cdn/img.png",
        public_id: "img1",
        resource_type: "image",
      })
      .mockResolvedValueOnce({
        secure_url: "https://cdn/audio.webm",
        public_id: "aud1",
        resource_type: "video",
      });

    const req = {
      files: [
        { path: "uploads/a.png", size: 1000, mimetype: "image/png" },
        { path: "uploads/b.webm", size: 1000, mimetype: "audio/webm" },
      ],
    };

    await uploadToCloudinary(req, res, next);

    expect(req.imageUrl).toEqual(["https://cdn/img.png"]);
    expect(req.audioUrl).toEqual(["https://cdn/audio.webm"]);
    expect(req.videoUrl).toEqual([]);
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalled();
  });

  it("destroys partial Cloudinary uploads if another file in the batch fails", async () => {
    cloudinary.uploader.upload
      .mockResolvedValueOnce({
        secure_url: "https://cdn/img.png",
        public_id: "img1",
        resource_type: "image",
      })
      .mockRejectedValueOnce(new Error("Upload failed"));
    cloudinary.uploader.destroy.mockResolvedValue({ result: "ok" });

    const req = {
      files: [
        { path: "uploads/a.png", size: 1000, mimetype: "image/png" },
        { path: "uploads/b.png", size: 1000, mimetype: "image/png" },
      ],
    };

    await uploadToCloudinary(req, res, next);

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("img1", {
      resource_type: "image",
    });
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
