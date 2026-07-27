package com.luneng.smartstore.common.api;

import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.persistence.EntityNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.NoSuchElementException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiResponse<Void>> validation(
        MethodArgumentNotValidException exception,
        HttpServletRequest request
    ) {
        String message = exception.getBindingResult().getFieldErrors().stream()
            .findFirst()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .orElse("请求参数不合法");
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message, request);
    }

    @ExceptionHandler(BusinessException.class)
    ResponseEntity<ApiResponse<Void>> business(
        BusinessException exception,
        HttpServletRequest request
    ) {
        return error(exception.getStatus(), exception.getCode(), exception.getMessage(), request);
    }

    @ExceptionHandler({EntityNotFoundException.class, NoSuchElementException.class})
    ResponseEntity<ApiResponse<Void>> notFound(
        RuntimeException exception,
        HttpServletRequest request
    ) {
        return error(HttpStatus.NOT_FOUND, "NOT_FOUND", "记录不存在", request);
    }

    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<ApiResponse<Void>> illegalState(
        IllegalStateException exception,
        HttpServletRequest request
    ) {
        return error(HttpStatus.CONFLICT, "ORDER_STATE_CONFLICT", exception.getMessage(), request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiResponse<Void>> forbidden(
        AccessDeniedException exception,
        HttpServletRequest request
    ) {
        return error(HttpStatus.FORBIDDEN, "FORBIDDEN", "无权执行该操作", request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiResponse<Void>> unexpected(
        Exception exception,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        LOGGER.error("Unexpected error, requestId={}", requestId, exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiResponse.error("INTERNAL_ERROR", "系统内部错误", requestId));
    }

    private ResponseEntity<ApiResponse<Void>> error(
        HttpStatus status,
        String code,
        String message,
        HttpServletRequest request
    ) {
        return ResponseEntity.status(status)
            .body(ApiResponse.error(code, message, RequestIdFilter.requestId(request)));
    }
}
