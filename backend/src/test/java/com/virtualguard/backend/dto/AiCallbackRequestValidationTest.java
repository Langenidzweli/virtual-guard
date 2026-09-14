package com.virtualguard.backend.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class AiCallbackRequestValidationTest {

    private static jakarta.validation.ValidatorFactory validatorFactory;
    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validatorFactory = Validation.buildDefaultValidatorFactory();
        validator = validatorFactory.getValidator();
    }

    @AfterAll
    static void closeValidator() {
        validatorFactory.close();
    }

    @Test
    void acceptsValidCompletedAnalysis() {
        AiCallbackRequest request = validRequest();

        assertEquals(0, validator.validate(request).size());
    }

    @Test
    void rejectsOutOfRangeScoresAndMalformedDetection() {
        AiCallbackRequest request = new AiCallbackRequest(
                "unknown",
                1.5,
                -1.0,
                List.of(new AiCallbackRequest.AiDetectionRequest(
                        -1, "", 2.0, -1, List.of(1.0, 2.0))),
                Map.of("total", -1L),
                "annotated.mp4",
                "failed");

        assertFalse(validator.validate(request).isEmpty());
    }

    private AiCallbackRequest validRequest() {
        return new AiCallbackRequest(
                "shoplifting",
                0.91,
                82.5,
                List.of(new AiCallbackRequest.AiDetectionRequest(
                        12, "people", 0.88, 1, List.of(1.0, 2.0, 3.0, 4.0))),
                Map.of("totalDetections", 1L),
                "annotated.mp4",
                "completed");
    }

    @Test
    void validatesReviewIntervalsAndPreservesOptionalLegacyPayload() throws Exception {
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        for (var segment : List.of(
                new AiCallbackRequest.ReviewSegment(10.0, 5.0, .9),
                new AiCallbackRequest.ReviewSegment(-1.0, 5.0, .9),
                new AiCallbackRequest.ReviewSegment(0.0, Double.POSITIVE_INFINITY, .9))) {
            var request = new AiCallbackRequest("shoplifting", .9, 90.0, List.of(), Map.of(),
                    "video.mp4", "completed", List.of(segment));
            assertFalse(validator.validate(request).isEmpty());
        }
        var request = new AiCallbackRequest("shoplifting", .9, 90.0, List.of(), Map.of(),
                "video.mp4", "completed", List.of(new AiCallbackRequest.ReviewSegment(5.0, 15.0, .9)));
        var restored = mapper.readValue(mapper.writeValueAsString(request), AiCallbackRequest.class);
        assertEquals(0, validator.validate(restored).size());
        assertEquals(5.0, restored.review_segments().get(0).start_seconds());
    }
}
