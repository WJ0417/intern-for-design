cc_library(
    name = "lip_track_calculator",
    srcs = ["lip_track_calculator.cc"],
    deps = [
        ":lip_track_calculator_cc_proto",
        "//mediapipe/examples/desktop/autoflip:autoflip_messages_cc_proto",
        "//mediapipe/framework:calculator_framework",
        "//mediapipe/framework/formats:detection_cc_proto",
        "//mediapipe/framework/formats:landmark_cc_proto",
        "//mediapipe/framework/formats:rect_cc_proto",
        "//mediapipe/framework/port:opencv_core",
        "//mediapipe/framework/port:opencv_imgproc",
        "//mediapipe/framework/formats:image_frame",
        "//mediapipe/framework/formats:image_frame_opencv",
        "//mediapipe/framework/port:ret_check",
        "//mediapipe/framework/port:status",
        "@com_google_absl//absl/memory",
    ],
    alwayslink = 1,
)

proto_library(
    name = "lip_track_calculator_proto",
    srcs = ["lip_track_calculator.proto"],
    deps = [
        "//mediapipe/framework:calculator_proto",
    ],
)

mediapipe_cc_proto_library(
    name = "lip_track_calculator_cc_proto",
    srcs = ["lip_track_calculator.proto"],
    cc_deps = [
        "//mediapipe/framework:calculator_cc_proto",
    ],
    visibility = ["//mediapipe/examples:__subpackages__"],
    deps = [":lip_track_calculator_proto"],
)

cc_test(
    name = "lip_track_calculator_test",
    srcs = ["lip_track_calculator_test.cc"],
    linkstatic = 1,
    deps = [
        ":lip_track_calculator",
        ":lip_track_calculator_cc_proto",
        "//mediapipe/examples/desktop/autoflip:autoflip_messages_cc_proto",
        "//mediapipe/framework:calculator_framework",
        "//mediapipe/framework:calculator_runner",
        "//mediapipe/framework/formats:detection_cc_proto",
        "//mediapipe/framework/formats:image_frame",
        "//mediapipe/framework/formats:image_frame_opencv",
        "//mediapipe/framework/formats:landmark_cc_proto",
        "//mediapipe/framework/formats:rect_cc_proto",
        "//mediapipe/framework/formats:location_data_cc_proto",
        "//mediapipe/framework/port:gtest_main",
        "//mediapipe/framework/port:parse_text_proto",
        "//mediapipe/framework/port:ret_check",
        "//mediapipe/framework/port:status",
        "@com_google_absl//absl/strings",
    ],
)
