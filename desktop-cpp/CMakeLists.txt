cmake_minimum_required(VERSION 3.20)
project(RamazanogluTechMailHQ
    VERSION 1.0.0
    DESCRIPTION "Ramazanoğlu Tech Mail HQ - Cloud-Synced C++20 Super Admin Desktop Suite"
    LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Enable Qt MOC, RCC, UIC automation
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

# Find Qt 6 Framework components
find_package(Qt6 6.2 REQUIRED COMPONENTS
    Core
    Gui
    Widgets
    Network
    WebSockets
)

# Project Header & Source Files
set(SOURCES
    src/main.cpp
    src/MainWindow.cpp
    src/ApiClient.cpp
    src/ComposeDialog.cpp
    src/AddAliasDialog.cpp
)

set(HEADERS
    src/MainWindow.h
    src/ApiClient.h
    src/ComposeDialog.h
    src/AddAliasDialog.h
    src/Models.h
)

set(RESOURCES
    resources/resources.qrc
    resources/app.rc
)

# Define Executable
add_executable(${PROJECT_NAME}
    ${SOURCES}
    ${HEADERS}
    ${RESOURCES}
)

target_include_directories(${PROJECT_NAME} PRIVATE
    src
)

target_link_libraries(${PROJECT_NAME} PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
    Qt6::Network
    Qt6::WebSockets
)

# Target compile definitions
target_compile_definitions(${PROJECT_NAME} PRIVATE
    QT_DEPRECATED_WARNINGS
    QT_DISABLE_DEPRECATED_BEFORE=0x060000
)

# Windows deployment configuration
if(MSVC)
    target_compile_options(${PROJECT_NAME} PRIVATE /W4 /permissive- /utf-8)
endif()

message(STATUS "Configured ${PROJECT_NAME} with Qt6 and C++20.")
