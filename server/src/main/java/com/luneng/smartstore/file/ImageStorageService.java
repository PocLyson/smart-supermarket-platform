package com.luneng.smartstore.file;

import com.luneng.smartstore.common.api.BusinessException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ImageStorageService {
    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final long MAX_PIXELS = 40_000_000L;
    private static final Map<String, ImageType> TYPES = Map.of(
        "JPEG", new ImageType("jpg", MediaType.IMAGE_JPEG),
        "PNG", new ImageType("png", MediaType.IMAGE_PNG),
        "WEBP", new ImageType("webp", MediaType.parseMediaType("image/webp"))
    );

    private final Path root;

    public ImageStorageService(@Value("${smart-store.upload-dir}") String uploadDir) {
        try {
            root = Path.of(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(root);
        } catch (IOException | RuntimeException exception) {
            throw new IllegalStateException("无法初始化图片目录", exception);
        }
    }

    public ImageUploadResponse store(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) {
            throw invalid("图片不能为空且不能超过 5 MiB");
        }
        String declaredType = file.getContentType();
        if (!MediaType.IMAGE_JPEG_VALUE.equalsIgnoreCase(declaredType)
            && !MediaType.IMAGE_PNG_VALUE.equalsIgnoreCase(declaredType)
            && !"image/webp".equalsIgnoreCase(declaredType)) {
            throw invalid("仅支持 JPEG、PNG 和 WebP");
        }
        try {
            byte[] bytes = file.getBytes();
            DecodedImage decoded = decode(bytes);
            if (!decoded.type().mediaType().toString().equalsIgnoreCase(declaredType)) {
                throw invalid("图片内容与声明类型不一致");
            }
            String generatedName = UUID.randomUUID() + "." + decoded.type().extension();
            Path destination = safePath(generatedName);
            Files.write(destination, bytes, StandardOpenOption.CREATE_NEW);
            return new ImageUploadResponse(
                "/files/" + generatedName,
                decoded.width(),
                decoded.height(),
                bytes.length
            );
        } catch (BusinessException exception) {
            throw exception;
        } catch (IOException | RuntimeException exception) {
            throw invalid("图片读取或保存失败");
        }
    }

    public StoredImage load(String generatedName) {
        if (generatedName == null
            || !generatedName.matches(
                "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$"
            )) {
            throw new jakarta.persistence.EntityNotFoundException();
        }
        try {
            Path path = safePath(generatedName);
            if (!Files.isRegularFile(path)) {
                throw new jakarta.persistence.EntityNotFoundException();
            }
            String extension = generatedName.substring(generatedName.lastIndexOf('.') + 1);
            MediaType mediaType = switch (extension) {
                case "jpg" -> MediaType.IMAGE_JPEG;
                case "png" -> MediaType.IMAGE_PNG;
                case "webp" -> MediaType.parseMediaType("image/webp");
                default -> throw new jakarta.persistence.EntityNotFoundException();
            };
            Resource resource = new UrlResource(path.toUri());
            return new StoredImage(resource, mediaType);
        } catch (IOException exception) {
            throw new jakarta.persistence.EntityNotFoundException();
        }
    }

    private DecodedImage decode(byte[] bytes) throws IOException {
        try (
            ByteArrayInputStream input = new ByteArrayInputStream(bytes);
            ImageInputStream imageInput = ImageIO.createImageInputStream(input)
        ) {
            if (imageInput == null) {
                throw invalid("无法识别图片");
            }
            var readers = ImageIO.getImageReaders(imageInput);
            if (!readers.hasNext()) {
                throw invalid("图片内容无效");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(imageInput, true, true);
                String format = reader.getFormatName().toUpperCase(Locale.ROOT);
                ImageType type = TYPES.get(format);
                if (type == null) {
                    throw invalid("图片格式不受支持");
                }
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > MAX_PIXELS) {
                    throw invalid("图片尺寸无效或过大");
                }
                BufferedImage image = reader.read(0);
                if (image == null || image.getWidth() != width || image.getHeight() != height) {
                    throw invalid("图片解码失败");
                }
                return new DecodedImage(type, width, height);
            } finally {
                reader.dispose();
            }
        }
    }

    private Path safePath(String generatedName) {
        Path destination = root.resolve(generatedName).normalize();
        if (!destination.startsWith(root)) {
            throw invalid("非法图片路径");
        }
        return destination;
    }

    private BusinessException invalid(String message) {
        return new BusinessException("INVALID_IMAGE", message, HttpStatus.BAD_REQUEST);
    }

    public record ImageUploadResponse(String url, int width, int height, long size) {
    }

    public record StoredImage(Resource resource, MediaType mediaType) {
    }

    private record ImageType(String extension, MediaType mediaType) {
    }

    private record DecodedImage(ImageType type, int width, int height) {
    }
}
