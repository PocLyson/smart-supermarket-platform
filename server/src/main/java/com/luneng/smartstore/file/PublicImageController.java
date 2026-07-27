package com.luneng.smartstore.file;

import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/files")
public class PublicImageController {
    private final ImageStorageService service;

    public PublicImageController(ImageStorageService service) {
        this.service = service;
    }

    @GetMapping("/{generatedName}")
    ResponseEntity<Resource> image(@PathVariable String generatedName) {
        ImageStorageService.StoredImage image = service.load(generatedName);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noCache())
            .contentType(image.mediaType())
            .body(image.resource());
    }
}
